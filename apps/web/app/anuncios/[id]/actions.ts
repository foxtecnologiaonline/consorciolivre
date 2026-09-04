"use server";

import { redirect } from "next/navigation";
import { requireProfile, requireUser } from "@/lib/auth";

export async function criarProposta(formData: FormData) {
  const { supabase, profile } = await requireProfile();

  const anuncioId = String(formData.get("anuncio_id") ?? "");
  const valor = Number(String(formData.get("valor") ?? "0").replace(",", "."));

  if (profile.kyc_status !== "aprovado") {
    redirect(`/anuncios/${anuncioId}?erro=${encodeURIComponent("Verifique sua identidade antes de propor ou comprar.")}`);
  }

  const { data: anuncio } = await supabase
    .from("anuncios")
    .select("id, vendedor_id, status")
    .eq("id", anuncioId)
    .maybeSingle();

  if (!anuncio || anuncio.status !== "publicado") {
    redirect(`/anuncios/${anuncioId}?erro=${encodeURIComponent("Este anúncio não está mais disponível.")}`);
  }

  if (anuncio!.vendedor_id === profile.id) {
    redirect(`/anuncios/${anuncioId}?erro=${encodeURIComponent("Você não pode propor no seu próprio anúncio.")}`);
  }

  if (!valor || valor <= 0) {
    redirect(`/anuncios/${anuncioId}?erro=${encodeURIComponent("Informe um valor válido.")}`);
  }

  const { error } = await supabase.from("propostas").insert({
    anuncio_id: anuncioId,
    comprador_id: profile.id,
    valor,
  });

  if (error) redirect(`/anuncios/${anuncioId}?erro=${encodeURIComponent(error.message)}`);

  redirect(`/anuncios/${anuncioId}?sucesso=${encodeURIComponent("Proposta enviada! Acompanhe em Minhas propostas.")}`);
}

export async function abrirConversa(formData: FormData) {
  const { supabase, user } = await requireUser();
  const anuncioId = String(formData.get("anuncio_id") ?? "");

  const { data: anuncio } = await supabase
    .from("anuncios")
    .select("id, vendedor_id")
    .eq("id", anuncioId)
    .maybeSingle();

  if (!anuncio) redirect(`/anuncios/${anuncioId}`);
  if (anuncio!.vendedor_id === user.id) redirect(`/anuncios/${anuncioId}`);

  const { data: threadExistente } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("anuncio_id", anuncioId)
    .eq("comprador_id", user.id)
    .maybeSingle();

  if (threadExistente) redirect(`/painel/chat/${threadExistente.id}`);

  const { data: thread, error } = await supabase
    .from("chat_threads")
    .insert({ anuncio_id: anuncioId, comprador_id: user.id, vendedor_id: anuncio!.vendedor_id })
    .select("id")
    .single();

  if (error || !thread) redirect(`/anuncios/${anuncioId}?erro=${encodeURIComponent("Não foi possível iniciar a conversa.")}`);

  redirect(`/painel/chat/${thread!.id}`);
}
