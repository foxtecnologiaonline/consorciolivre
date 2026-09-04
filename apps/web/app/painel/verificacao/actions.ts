"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

async function uploadDocumento(
  supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"],
  profileId: string,
  file: File,
  nome: string
) {
  const extensao = file.name.split(".").pop() ?? "bin";
  const caminho = `${profileId}/${nome}-${Date.now()}.${extensao}`;

  const { error } = await supabase.storage.from("kyc-documentos").upload(caminho, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) throw error;
  return caminho;
}

export async function solicitarVerificacao(formData: FormData) {
  const { supabase, profile } = await requireProfile();

  if (profile.kyc_status === "em_analise" || profile.kyc_status === "aprovado") {
    redirect("/painel/verificacao");
  }

  const documentoFrente = formData.get("documento_frente") as File | null;
  const selfie = formData.get("selfie") as File | null;

  if (!documentoFrente || documentoFrente.size === 0 || !selfie || selfie.size === 0) {
    redirect("/painel/verificacao?erro=" + encodeURIComponent("Envie o documento e a selfie."));
  }

  try {
    const documentoPath = await uploadDocumento(supabase, profile.id, documentoFrente!, "documento");
    const selfiePath = await uploadDocumento(supabase, profile.id, selfie!, "selfie");

    // MVP: revisão manual por staff em vez de provedor de KYC integrado (ver
    // docs/ARCHITECTURE.md, seção 5.1 — Idwall/unico/CAF entram numa fase 2).
    // Os campos *_url guardam o caminho no bucket privado, não uma URL pública —
    // a exibição para staff usa signed URL de curta duração (ver /painel/admin/kyc).
    const { error } = await supabase.from("kyc_verificacoes").insert({
      profile_id: profile.id,
      provedor: "manual",
      documento_frente_url: documentoPath,
      selfie_url: selfiePath,
    });

    if (error) throw error;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao enviar verificação.";
    redirect(`/painel/verificacao?erro=${encodeURIComponent(message)}`);
  }

  redirect("/painel/verificacao");
}
