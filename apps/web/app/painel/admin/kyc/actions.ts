"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { notificar } from "@/lib/notificacoes/notificar";
import { notificacaoRevisaoKyc } from "@/lib/notificacoes/copy";

export async function revisarKyc(formData: FormData) {
  const { supabase } = await requireStaff();

  const id = String(formData.get("id"));
  const decisao = String(formData.get("decisao")) as "aprovado" | "reprovado";
  const motivo_reprovacao = String(formData.get("motivo_reprovacao") ?? "").trim() || null;

  const { data: verificacao } = await supabase
    .from("kyc_verificacoes")
    .update({
      status: decisao,
      motivo_reprovacao: decisao === "reprovado" ? motivo_reprovacao : null,
      concluido_em: new Date().toISOString(),
    })
    .eq("id", id)
    .select("profile_id")
    .single();

  if (verificacao) {
    await notificar({ profileId: verificacao.profile_id, ...notificacaoRevisaoKyc(decisao, motivo_reprovacao) });
  }

  revalidatePath("/painel/admin/kyc");
}
