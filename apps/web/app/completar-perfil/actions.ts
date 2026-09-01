"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export async function salvarPerfil(formData: FormData) {
  const { supabase, user } = await requireUser();

  const tipo_pessoa = String(formData.get("tipo_pessoa") ?? "pf") as "pf" | "pj";
  const nome_completo = String(formData.get("nome_completo") ?? "").trim();
  const documento = String(formData.get("documento") ?? "").replace(/\D/g, "");
  const telefone = String(formData.get("telefone") ?? "").replace(/\D/g, "");

  if (!nome_completo || !documento) {
    redirect("/completar-perfil?erro=" + encodeURIComponent("Nome e documento são obrigatórios."));
  }

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    tipo_pessoa,
    nome_completo,
    documento,
    telefone: telefone || null,
  });

  if (error) redirect(`/completar-perfil?erro=${encodeURIComponent(error.message)}`);

  redirect("/painel");
}
