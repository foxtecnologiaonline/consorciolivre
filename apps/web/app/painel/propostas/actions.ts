"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

export async function aceitarProposta(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const propostaId = String(formData.get("id"));

  const { data: proposta } = await supabase
    .from("propostas")
    .select("id, anuncio_id, comprador_id, valor, status, anuncios(vendedor_id, status)")
    .eq("id", propostaId)
    .maybeSingle<any>();

  if (!proposta || proposta.status !== "pendente") {
    redirect("/painel/propostas?erro=" + encodeURIComponent("Proposta não encontrada ou já respondida."));
  }

  if (proposta!.anuncios.vendedor_id !== profile.id) {
    redirect("/painel/propostas?erro=" + encodeURIComponent("Você não pode responder esta proposta."));
  }

  if (proposta!.anuncios.status !== "publicado") {
    redirect("/painel/propostas?erro=" + encodeURIComponent("Este anúncio não está mais disponível."));
  }

  const { data: transacao, error: erroTransacao } = await supabase
    .from("transacoes")
    .insert({
      anuncio_id: proposta!.anuncio_id,
      proposta_id: proposta!.id,
      comprador_id: proposta!.comprador_id,
      vendedor_id: profile.id,
      valor_acordado: proposta!.valor,
    })
    .select("id")
    .single();

  if (erroTransacao || !transacao) {
    redirect(`/painel/propostas?erro=${encodeURIComponent(erroTransacao?.message ?? "Erro ao criar transação.")}`);
  }

  await supabase.from("transacao_eventos").insert({
    transacao_id: transacao!.id,
    status_novo: "aguardando_pagamento",
    ator_id: profile.id,
    observacao: "Proposta aceita pelo vendedor.",
  });

  await supabase.from("propostas").update({ status: "aceita", respondido_em: new Date().toISOString() }).eq("id", propostaId);

  // Reserva a cota: recusa automaticamente as outras propostas pendentes e tira o
  // anúncio de circulação (índice único de "um anúncio ativo por cota" já impede
  // publicar outro, mas isso evita novas propostas em cima do que acabou de vender).
  await supabase
    .from("propostas")
    .update({ status: "recusada", respondido_em: new Date().toISOString() })
    .eq("anuncio_id", proposta!.anuncio_id)
    .eq("status", "pendente");

  await supabase.from("anuncios").update({ status: "vendido" }).eq("id", proposta!.anuncio_id);

  revalidatePath("/painel/propostas");
  redirect(`/painel/transacoes/${transacao!.id}`);
}

export async function recusarProposta(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const propostaId = String(formData.get("id"));

  const { data: proposta } = await supabase
    .from("propostas")
    .select("id, status, anuncios(vendedor_id)")
    .eq("id", propostaId)
    .maybeSingle<any>();

  if (!proposta || proposta.anuncios.vendedor_id !== profile.id) {
    redirect("/painel/propostas?erro=" + encodeURIComponent("Proposta não encontrada."));
  }

  await supabase
    .from("propostas")
    .update({ status: "recusada", respondido_em: new Date().toISOString() })
    .eq("id", propostaId);

  revalidatePath("/painel/propostas");
}
