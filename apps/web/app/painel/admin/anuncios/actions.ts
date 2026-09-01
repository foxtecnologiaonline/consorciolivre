"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";

export async function revisarAnuncio(formData: FormData) {
  const { supabase } = await requireStaff();

  const id = String(formData.get("id"));
  const decisao = String(formData.get("decisao")) as "publicado" | "reprovado";
  const motivo_reprovacao = String(formData.get("motivo_reprovacao") ?? "").trim() || null;

  await supabase
    .from("anuncios")
    .update({
      status: decisao,
      motivo_reprovacao: decisao === "reprovado" ? motivo_reprovacao : null,
      publicado_em: decisao === "publicado" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  revalidatePath("/painel/admin/anuncios");
}
