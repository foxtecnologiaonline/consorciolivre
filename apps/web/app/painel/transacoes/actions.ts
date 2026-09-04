"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

async function carregarTransacao(supabase: any, id: string) {
  const { data } = await supabase.from("transacoes").select("*").eq("id", id).maybeSingle();
  return data;
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

// Comprador confirma que fez o pagamento (fora da plataforma, PIX/transferência
// combinado no chat — não há gateway integrado neste MVP). Isso NÃO libera nada
// automaticamente: só avisa o vendedor para conferir e iniciar a transferência
// da cota junto à administradora.
export async function marcarPagamentoRealizado(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const id = String(formData.get("id"));
  const transacao = await carregarTransacao(supabase, id);

  if (!transacao || transacao.comprador_id !== profile.id || transacao.status !== "aguardando_pagamento") {
    redirect(`/painel/transacoes/${id}?erro=` + encodeURIComponent("Ação não permitida neste momento."));
  }

  await supabase.from("transacoes").update({ status: "pagamento_em_escrow" }).eq("id", id);
  await registrarEvento(
    supabase,
    id,
    "aguardando_pagamento",
    "pagamento_em_escrow",
    profile.id,
    "Comprador confirmou o pagamento."
  );

  revalidatePath(`/painel/transacoes/${id}`);
}

// Vendedor confirma que recebeu o valor e vai iniciar a transferência de
// titularidade da cota junto à administradora.
export async function confirmarRecebimento(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const id = String(formData.get("id"));
  const transacao = await carregarTransacao(supabase, id);

  if (!transacao || transacao.vendedor_id !== profile.id || transacao.status !== "pagamento_em_escrow") {
    redirect(`/painel/transacoes/${id}?erro=` + encodeURIComponent("Ação não permitida neste momento."));
  }

  await supabase.from("transacoes").update({ status: "em_transferencia" }).eq("id", id);
  await registrarEvento(
    supabase,
    id,
    "pagamento_em_escrow",
    "em_transferencia",
    profile.id,
    "Vendedor confirmou o recebimento e iniciou a transferência na administradora."
  );

  revalidatePath(`/painel/transacoes/${id}`);
}

// Comprador confirma que a administradora já efetivou a transferência da cota
// para o nome dele — só então o valor é considerado liberado ao vendedor.
export async function confirmarTransferencia(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const id = String(formData.get("id"));
  const transacao = await carregarTransacao(supabase, id);

  if (!transacao || transacao.comprador_id !== profile.id || transacao.status !== "em_transferencia") {
    redirect(`/painel/transacoes/${id}?erro=` + encodeURIComponent("Ação não permitida neste momento."));
  }

  await supabase.from("transacoes").update({ status: "concluida" }).eq("id", id);
  await registrarEvento(
    supabase,
    id,
    "em_transferencia",
    "concluida",
    profile.id,
    "Comprador confirmou a transferência da cota. Transação concluída."
  );

  revalidatePath(`/painel/transacoes/${id}`);
}

export async function abrirDisputa(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const id = String(formData.get("id"));
  const motivo = String(formData.get("motivo") ?? "").trim();
  const transacao = await carregarTransacao(supabase, id);

  if (!transacao || (transacao.comprador_id !== profile.id && transacao.vendedor_id !== profile.id)) {
    redirect(`/painel/transacoes/${id}?erro=` + encodeURIComponent("Ação não permitida."));
  }
  if (!["pagamento_em_escrow", "em_transferencia"].includes(transacao.status)) {
    redirect(`/painel/transacoes/${id}?erro=` + encodeURIComponent("Só é possível abrir disputa após o pagamento."));
  }

  await supabase.from("transacoes").update({ status: "em_disputa" }).eq("id", id);
  await registrarEvento(supabase, id, transacao.status, "em_disputa", profile.id, motivo || "Disputa aberta.");

  revalidatePath(`/painel/transacoes/${id}`);
}

// Cancelamento só antes de qualquer pagamento confirmado — depois disso, só staff
// resolve (via disputa). Reabre o anúncio para outros compradores.
export async function cancelarTransacao(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const id = String(formData.get("id"));
  const transacao = await carregarTransacao(supabase, id);

  if (
    !transacao ||
    (transacao.comprador_id !== profile.id && transacao.vendedor_id !== profile.id) ||
    transacao.status !== "aguardando_pagamento"
  ) {
    redirect(`/painel/transacoes/${id}?erro=` + encodeURIComponent("Ação não permitida neste momento."));
  }

  await supabase.from("transacoes").update({ status: "cancelada" }).eq("id", id);
  await registrarEvento(supabase, id, "aguardando_pagamento", "cancelada", profile.id, "Transação cancelada.");
  await supabase.from("anuncios").update({ status: "publicado" }).eq("id", transacao.anuncio_id);

  revalidatePath(`/painel/transacoes/${id}`);
}
