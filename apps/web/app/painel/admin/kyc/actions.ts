"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";

export async function revisarKyc(formData: FormData) {
  const { supabase } = await requireStaff();

  const id = String(formData.get("id"));
  const decisao = String(formData.get("decisao")) as "aprovado" | "reprovado";
  const motivo_reprovacao = String(formData.get("motivo_reprovacao") ?? "").trim() || null;

  await supabase
    .from("kyc_verificacoes")
    .update({
      status: decisao,
      motivo_reprovacao: decisao === "reprovado" ? motivo_reprovacao : null,
      concluido_em: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/painel/admin/kyc");
}
