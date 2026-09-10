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
  marcarPagamentoRealizado as aplicarMarcacaoPagamento,
} from "@/lib/transacoes/state-machine";
import type { Transacao as TransacaoDominio, TransacaoStatus } from "@/lib/transacoes/state-machine";

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

export async function marcarPagamentoRealizado(formData: FormData) {
  const id = String(formData.get("id"));
  await executarTransicao(id, aplicarMarcacaoPagamento, "Comprador confirmou o pagamento.");
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
  await executarTransicao(
    id,
    aplicarConfirmacaoTransferencia,
    "Comprador confirmou a transferência da cota. Transação concluída."
  );
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
