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
import { criarPedidoBoleto, criarPedidoPix, PagarmeError } from "@/lib/pagarme/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { liberarEscrow } from "@/lib/pagamentos/escrow";
import { notificar } from "@/lib/notificacoes/notificar";

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

async function transacaoParaCobranca(id: string) {
  const { supabase, user, profile } = await requireProfile();
  const transacao = await carregarTransacao(supabase, id);

  if (!transacao || transacao.comprador_id !== profile.id || transacao.status !== "aguardando_pagamento") {
    redirect(`/painel/transacoes/${id}?erro=` + encodeURIComponent("Ação não permitida neste momento."));
  }
  if (!user.email) {
    redirect(
      `/painel/transacoes/${id}?erro=` + encodeURIComponent("Cadastre um e-mail na sua conta para gerar a cobrança.")
    );
  }

  return { supabase, profile, transacao: transacao!, email: user.email! };
}

async function cobrancaPendenteValida(supabase: any, id: string, metodo: "pix" | "boleto") {
  const { data } = await supabase
    .from("pagamentos")
    .select("metodo, pix_qr_code, boleto_url, expira_em")
    .eq("transacao_id", id)
    .eq("status", "pendente")
    .maybeSingle();

  const referencia = metodo === "pix" ? data?.pix_qr_code : data?.boleto_url;
  return Boolean(data?.metodo === metodo && referencia && data.expira_em && new Date(data.expira_em) > new Date());
}

// pagamentos só tem policy de SELECT pro client comum (ver
// supabase/migrations/0001_init.sql) — escrita é sempre via service_role,
// mesmo essa que só registra a cobrança recém-criada no Pagar.me.
async function inserirPagamentoPendente(id: string, valor: number, dados: Record<string, unknown>) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("pagamentos")
    .insert({ transacao_id: id, gateway: "pagarme", valor, status: "pendente", ...dados });

  if (error && (error as { code?: string }).code !== "23505") {
    // 23505 = unique_violation do índice idx_pagamentos_transacao_pendente:
    // outra requisição concorrente já criou a cobrança pendente — não é erro
    // do ponto de vista do usuário, só mostra a que já existe.
    redirect(`/painel/transacoes/${id}?erro=${encodeURIComponent(error.message)}`);
  }
}

// Gera (ou reaproveita, se ainda válido) a cobrança PIX da transação. A
// confirmação de pagamento em si NÃO acontece aqui — vem só do webhook do
// Pagar.me (app/api/webhooks/pagarme/route.ts), nunca de autodeclaração do
// comprador.
export async function gerarCobrancaPix(formData: FormData) {
  const id = String(formData.get("id"));
  const { supabase, profile, transacao, email } = await transacaoParaCobranca(id);

  if (await cobrancaPendenteValida(supabase, id, "pix")) return;

  let pedido;
  try {
    pedido = await criarPedidoPix({
      valorCentavos: Math.round(transacao.valor_acordado * 100),
      descricao: `Consórcio Livre — transação ${id}`,
      referenciaExterna: id,
      cliente: {
        nome: profile.nome_completo,
        email,
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

  await inserirPagamentoPendente(id, transacao.valor_acordado, {
    gateway_referencia: pedido.orderId,
    gateway_charge_id: pedido.chargeId,
    metodo: "pix",
    pix_qr_code: pedido.qrCode,
    pix_qr_code_url: pedido.qrCodeUrl,
    expira_em: pedido.expiraEm,
  });

  revalidatePath(`/painel/transacoes/${id}`);
}

// Mesmo modelo do PIX, vencimento fixo em 3 dias corridos (decisão de
// produto, ajustável aqui se precisar).
export async function gerarCobrancaBoleto(formData: FormData) {
  const id = String(formData.get("id"));
  const { supabase, profile, transacao, email } = await transacaoParaCobranca(id);

  if (await cobrancaPendenteValida(supabase, id, "boleto")) return;

  const vencimentoEm = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  let pedido;
  try {
    pedido = await criarPedidoBoleto({
      valorCentavos: Math.round(transacao.valor_acordado * 100),
      descricao: `Consórcio Livre — transação ${id}`,
      referenciaExterna: id,
      vencimentoEm,
      cliente: {
        nome: profile.nome_completo,
        email,
        documento: profile.documento,
        tipoPessoa: profile.tipo_pessoa === "pf" ? "individual" : "company",
      },
    });
  } catch (erro) {
    const mensagem =
      erro instanceof PagarmeError
        ? "Não foi possível gerar o boleto agora. Tente novamente em instantes."
        : "Erro inesperado ao gerar a cobrança.";
    redirect(`/painel/transacoes/${id}?erro=${encodeURIComponent(mensagem)}`);
  }

  await inserirPagamentoPendente(id, transacao.valor_acordado, {
    gateway_referencia: pedido.orderId,
    gateway_charge_id: pedido.chargeId,
    metodo: "boleto",
    boleto_linha_digitavel: pedido.linhaDigitavel,
    boleto_url: pedido.url,
    boleto_pdf_url: pedido.pdfUrl,
    expira_em: pedido.expiraEm,
  });

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
  const { transacao, profile } = await executarTransicao(id, aplicarAberturaDisputa, motivo || "Disputa aberta.");

  const outraParte = profile.id === transacao.comprador_id ? transacao.vendedor_id : transacao.comprador_id;
  await notificar({
    profileId: outraParte,
    tipo: "disputa_aberta",
    titulo: "Disputa aberta",
    corpo: "Uma disputa foi aberta nesta negociação. Nossa equipe vai analisar e entrar em contato.",
  });
}

// Cancelamento reabre o anúncio para outros compradores.
export async function cancelarTransacao(formData: FormData) {
  const id = String(formData.get("id"));
  const { transacao, supabase } = await executarTransicao(id, aplicarCancelamento, "Transação cancelada.");
  await supabase.from("anuncios").update({ status: "publicado" }).eq("id", transacao.anuncio_id);
}
