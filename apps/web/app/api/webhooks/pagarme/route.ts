import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TransicaoInvalidaError, confirmarPagamentoGateway } from "@/lib/transacoes/state-machine";
import { autenticado, eventoIndicaPago, extrairIdPedido, type PagarmeWebhookPayload } from "@/lib/pagarme/webhook";
import { notificar } from "@/lib/notificacoes/notificar";

// Webhook do Pagar.me — confirma pagamento PIX real (docs/ARCHITECTURE.md §8
// item 4/5). Autenticação via Basic Auth configurada no dashboard do Pagar.me
// (usuário/senha combinados com PAGARME_WEBHOOK_USER/PASSWORD — ver
// lib/pagarme/webhook.ts para o porquê da interpretação do payload não ser
// 100% garantida sem acesso a sandbox neste ambiente).
//
// Idempotência (regra não-negociável do projeto): identificada por
// `pagamentos.gateway_referencia` (id do pedido) — reentrega do mesmo evento
// não reprocessa, porque só agimos quando pagamentos.status ainda é
// 'pendente'.
export async function POST(request: NextRequest) {
  if (!autenticado(request.headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: PagarmeWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const pedidoId = extrairIdPedido(payload);
  if (!pedidoId) {
    return NextResponse.json({ error: "unrecognized payload shape" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: pagamento } = await admin
    .from("pagamentos")
    .select("id, transacao_id, status")
    .eq("gateway", "pagarme")
    .eq("gateway_referencia", pedidoId)
    .maybeSingle();

  // Pedido que não reconhecemos ou evento já processado (reentrega): 200 para
  // o Pagar.me não continuar retentando, sem reprocessar nada.
  if (!pagamento || pagamento.status !== "pendente") {
    return NextResponse.json({ ok: true });
  }

  if (!eventoIndicaPago(payload)) {
    return NextResponse.json({ ok: true });
  }

  const { data: transacao } = await admin
    .from("transacoes")
    .select("id, status, comprador_id, vendedor_id")
    .eq("id", pagamento.transacao_id)
    .maybeSingle();

  if (!transacao) {
    return NextResponse.json({ ok: true });
  }

  try {
    const transicao = confirmarPagamentoGateway({
      status: transacao.status,
      compradorId: transacao.comprador_id,
      vendedorId: transacao.vendedor_id,
    });

    await admin
      .from("pagamentos")
      .update({ status: "confirmado", confirmado_em: new Date().toISOString() })
      .eq("id", pagamento.id);

    await admin.from("transacoes").update({ status: transicao.statusNovo }).eq("id", transacao.id);

    await admin.from("transacao_eventos").insert({
      transacao_id: transacao.id,
      status_anterior: transicao.statusAnterior,
      status_novo: transicao.statusNovo,
      ator_id: null,
      observacao: "Pagamento PIX confirmado pelo Pagar.me (webhook).",
    });

    await notificar({
      profileId: transacao.comprador_id,
      tipo: "pagamento_confirmado",
      titulo: "Pagamento confirmado",
      corpo: "Seu pagamento PIX foi confirmado e está retido em escrow até a transferência da cota.",
    });
    await notificar({
      profileId: transacao.vendedor_id,
      tipo: "pagamento_confirmado",
      titulo: "Pagamento recebido",
      corpo: "O pagamento da sua venda foi confirmado. Inicie a transferência da cota na administradora.",
    });
  } catch (erro) {
    if (erro instanceof TransicaoInvalidaError) {
      // Corrida com outro evento que já tratou a mesma transação — idempotente, ok.
      return NextResponse.json({ ok: true });
    }
    throw erro;
  }

  return NextResponse.json({ ok: true });
}
