"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import {
  TransicaoInvalidaError,
  abrirDisputa as aplicarAberturaDisputa,
  cancelarTransacao as aplicarCancelamento,
  confirmarRecebimento as aplicarConfirmacaoRecebimento,
  confirmarTransferencia as aplicarConfirmacaoTransferencia,
} from "@/lib/transacoes/state-machine";
import type { Transacao as TransacaoDominio, TransacaoStatus } from "@/lib/transacoes/state-machine";
import { criarPedidoPix, PagarmeError } from "@/lib/pagarme/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { liberarEscrow } from "@/lib/pagamentos/escrow";

async function carregarTransacao(supabase: any, id: string) {
  const { data } = await supabase.from("transacoes").select("*").eq("id", id).maybeSingle();
  return data;
}

function paraDominio(transacao: any): TransacaoDominio {
  return {
    status: transacao.status,
    compradorId: transacao.comprador_id,
    vendedorId: transacao.vendedor_id,
  };
}

async function registrarEvento(
  supabase: any,
  transacaoId: string,
  statusAnterior: string,
  statusNovo: string,
  atorId: string,
  observacao?: string
) {
  await supabase.from("transacao_eventos").insert({
    transacao_id: transacaoId,
    status_anterior: statusAnterior,
    status_novo: statusNovo,
    ator_id: atorId,
    observacao,
  });
}

async function executarTransicao(
  id: string,
  aplicar: (
    transacao: TransacaoDominio,
    atorId: string
  ) => { statusAnterior: TransacaoStatus; statusNovo: TransacaoStatus },
  observacao: string
) {
  const { supabase, profile } = await requireProfile();
  const transacao = await carregarTransacao(supabase, id);

  if (!transacao) {
    redirect(`/painel/transacoes/${id}?erro=` + encodeURIComponent("Transação não encontrada."));
  }

  let transicao;
  try {
    transicao = aplicar(paraDominio(transacao), profile.id);
  } catch (erro) {
    const mensagem = erro instanceof TransicaoInvalidaError ? erro.message : "Ação não permitida neste momento.";
    redirect(`/painel/transacoes/${id}?erro=` + encodeURIComponent(mensagem));
  }

  await supabase.from("transacoes").update({ status: transicao.statusNovo }).eq("id", id);
  await registrarEvento(supabase, id, transicao.statusAnterior, transicao.statusNovo, profile.id, observacao);

  revalidatePath(`/painel/transacoes/${id}`);
  return { transacao, profile, supabase };
}

// Gera (ou reaproveita, se ainda válido) a cobrança PIX da transação. A
// confirmação de pagamento em si NÃO acontece aqui — vem só do webhook do
// Pagar.me (app/api/webhooks/pagarme/route.ts), nunca de autodeclaração do
// comprador.
export async function gerarCobrancaPix(formData: FormData) {
  const { supabase, user, profile } = await requireProfile();
  const id = String(formData.get("id"));
  const transacao = await carregarTransacao(supabase, id);

  if (!transacao || transacao.comprador_id !== profile.id || transacao.status !== "aguardando_pagamento") {
    redirect(`/painel/transacoes/${id}?erro=` + encodeURIComponent("Ação não permitida neste momento."));
  }

  const { data: pagamentoPendente } = await supabase
    .from("pagamentos")
    .select("id, pix_qr_code, expira_em")
    .eq("transacao_id", id)
    .eq("status", "pendente")
    .maybeSingle();

  if (pagamentoPendente?.pix_qr_code && pagamentoPendente.expira_em && new Date(pagamentoPendente.expira_em) > new Date()) {
    // Já existe uma cobrança válida — não gera outra, só mostra a que existe.
    return;
  }

  if (!user.email) {
    redirect(
      `/painel/transacoes/${id}?erro=` +
        encodeURIComponent("Cadastre um e-mail na sua conta para gerar a cobrança PIX.")
    );
  }

  let pedido;
  try {
    pedido = await criarPedidoPix({
      valorCentavos: Math.round(transacao!.valor_acordado * 100),
      descricao: `Consórcio Livre — transação ${id}`,
      referenciaExterna: id,
      cliente: {
        nome: profile.nome_completo,
        email: user.email!,
        documento: profile.documento,
        tipoPessoa: profile.tipo_pessoa === "pf" ? "individual" : "company",
      },
    });
  } catch (erro) {
    const mensagem =
      erro instanceof PagarmeError
        ? "Não foi possível gerar a cobrança PIX agora. Tente novamente em instantes."
        : "Erro inesperado ao gerar a cobrança.";
    redirect(`/painel/transacoes/${id}?erro=${encodeURIComponent(mensagem)}`);
  }

  // pagamentos só tem policy de SELECT pro client comum (ver
  // supabase/migrations/0001_init.sql) — escrita é sempre via service_role,
  // mesmo essa que só registra o pedido PIX recém-criado no Pagar.me.
  const admin = createAdminClient();
  const { error } = await admin.from("pagamentos").insert({
    transacao_id: id,
    gateway: "pagarme",
    gateway_referencia: pedido.orderId,
    gateway_charge_id: pedido.chargeId,
    metodo: "pix",
    valor: transacao!.valor_acordado,
    status: "pendente",
    pix_qr_code: pedido.qrCode,
    pix_qr_code_url: pedido.qrCodeUrl,
    expira_em: pedido.expiraEm,
  });

  if (error) {
    // 23505 = unique_violation do índice idx_pagamentos_transacao_pendente:
    // outra requisição concorrente já criou a cobrança pendente — não é erro
    // do ponto de vista do usuário, só mostra a que já existe.
    if ((error as { code?: string }).code !== "23505") {
      redirect(`/painel/transacoes/${id}?erro=${encodeURIComponent(error.message)}`);
    }
  }

  revalidatePath(`/painel/transacoes/${id}`);
}

export async function confirmarRecebimento(formData: FormData) {
  const id = String(formData.get("id"));
  await executarTransicao(
    id,
    aplicarConfirmacaoRecebimento,
    "Vendedor confirmou o recebimento e iniciou a transferência na administradora."
  );
}

export async function confirmarTransferencia(formData: FormData) {
  const id = String(formData.get("id"));
  const { transacao } = await executarTransicao(
    id,
    aplicarConfirmacaoTransferencia,
    "Comprador confirmou a transferência da cota. Transação concluída."
  );
  await liberarEscrow(id, transacao.vendedor_id, transacao.valor_acordado - transacao.comissao_valor);
}

export async function abrirDisputa(formData: FormData) {
  const id = String(formData.get("id"));
  const motivo = String(formData.get("motivo") ?? "").trim();
  await executarTransicao(id, aplicarAberturaDisputa, motivo || "Disputa aberta.");
}

// Cancelamento reabre o anúncio para outros compradores.
export async function cancelarTransacao(formData: FormData) {
  const id = String(formData.get("id"));
  const { transacao, supabase } = await executarTransicao(id, aplicarCancelamento, "Transação cancelada.");
  await supabase.from("anuncios").update({ status: "publicado" }).eq("id", transacao.anuncio_id);
}
