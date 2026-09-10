import { createAdminClient } from "@/lib/supabase/admin";
import { criarTransferencia, estornarPagamento } from "@/lib/pagarme/client";

// Move o valor líquido da plataforma para o recipient_id do vendedor no
// Pagar.me — só quando a transferência de titularidade já foi confirmada (ou
// staff decide a disputa a favor do vendedor) é que o dinheiro sai de fato da
// conta da plataforma (docs/ARCHITECTURE.md §5.1). Roda sempre com
// service_role: quem dispara isso (comprador confirmando, ou staff numa
// disputa) não tem — nem deveria ter — permissão de RLS pra ler o
// pagarme_recipient_id do vendedor.
//
// Falha na transferência não é propagada como exceção: quem chama já mudou
// o status da transação/disputa e não deve desfazer isso por um problema do
// gateway — fica um evento em transacao_eventos para reconciliação manual.
export async function liberarEscrow(transacaoId: string, vendedorId: string, valorLiquido: number) {
  const admin = createAdminClient();

  const { data: vendedor } = await admin
    .from("profiles")
    .select("pagarme_recipient_id")
    .eq("id", vendedorId)
    .maybeSingle();

  const { data: pagamento } = await admin
    .from("pagamentos")
    .select("id")
    .eq("transacao_id", transacaoId)
    .eq("status", "confirmado")
    .maybeSingle();

  if (!vendedor?.pagarme_recipient_id || !pagamento) {
    await admin.from("transacao_eventos").insert({
      transacao_id: transacaoId,
      observacao: "Liberação de escrow não disparada automaticamente: sem recipient_id ou pagamento confirmado.",
      status_novo: "concluida",
    });
    return;
  }

  try {
    await criarTransferencia({
      recipientId: vendedor.pagarme_recipient_id,
      valorCentavos: Math.round(valorLiquido * 100),
      referenciaExterna: transacaoId,
    });
    await admin
      .from("pagamentos")
      .update({ status: "liberado_vendedor", liberado_em: new Date().toISOString() })
      .eq("id", pagamento.id);
    await admin.from("transacao_eventos").insert({
      transacao_id: transacaoId,
      observacao: "Escrow liberado: valor líquido transferido ao vendedor no Pagar.me.",
      status_novo: "concluida",
    });
  } catch {
    await admin.from("transacao_eventos").insert({
      transacao_id: transacaoId,
      observacao: "Falha ao transferir o escrow ao vendedor no Pagar.me — requer reconciliação manual.",
      status_novo: "concluida",
    });
  }
}

// Estorna o pagamento ao comprador — usado quando staff resolve uma disputa
// a favor dele. Como nunca houve split na cobrança, o estorno sai direto da
// conta da plataforma via cancelamento da charge, sem envolver o vendedor.
export async function estornarEscrow(transacaoId: string) {
  const admin = createAdminClient();

  const { data: pagamento } = await admin
    .from("pagamentos")
    .select("id, gateway_charge_id")
    .eq("transacao_id", transacaoId)
    .eq("status", "confirmado")
    .maybeSingle();

  if (!pagamento?.gateway_charge_id) {
    await admin.from("transacao_eventos").insert({
      transacao_id: transacaoId,
      observacao: "Estorno não disparado automaticamente: sem pagamento confirmado com charge conhecida.",
      status_novo: "reembolsada",
    });
    return;
  }

  try {
    await estornarPagamento(pagamento.gateway_charge_id);
    await admin.from("pagamentos").update({ status: "estornado" }).eq("id", pagamento.id);
    await admin.from("transacao_eventos").insert({
      transacao_id: transacaoId,
      observacao: "Pagamento estornado ao comprador no Pagar.me.",
      status_novo: "reembolsada",
    });
  } catch {
    await admin.from("transacao_eventos").insert({
      transacao_id: transacaoId,
      observacao: "Falha ao estornar o pagamento no Pagar.me — requer reconciliação manual.",
      status_novo: "reembolsada",
    });
  }
}
