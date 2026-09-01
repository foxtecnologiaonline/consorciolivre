"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export async function solicitarVerificacao(formData: FormData) {
  const { supabase, profile } = await requireProfile();

  if (profile.kyc_status === "em_analise" || profile.kyc_status === "aprovado") {
    redirect("/painel/verificacao");
  }

  const documento_frente_url = String(formData.get("documento_frente_url") ?? "").trim();
  const selfie_url = String(formData.get("selfie_url") ?? "").trim();

  if (!documento_frente_url || !selfie_url) {
    redirect("/painel/verificacao?erro=" + encodeURIComponent("Envie o documento e a selfie."));
  }

  // MVP: revisão manual por staff em vez de provedor de KYC integrado (ver
  // docs/ARCHITECTURE.md, seção 5.1 — Idwall/unico/CAF entram numa fase 2).
  // As URLs vêm de um upload para o Supabase Storage feito no client antes deste submit;
  // aqui só ficam persistidas.
  const { error } = await supabase.from("kyc_verificacoes").insert({
    profile_id: profile.id,
    provedor: "manual",
    documento_frente_url,
    selfie_url,
  });

  if (error) redirect(`/painel/verificacao?erro=${encodeURIComponent(error.message)}`);

  redirect("/painel/verificacao");
}
