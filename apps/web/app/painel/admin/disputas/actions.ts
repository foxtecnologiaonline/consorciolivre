"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";

export async function resolverDisputa(formData: FormData) {
  const { supabase, profile } = await requireStaff();

  const id = String(formData.get("id"));
  const decisao = String(formData.get("decisao")) as "concluida" | "reembolsada";
  const observacao = String(formData.get("observacao") ?? "").trim();

  const { data: transacao } = await supabase
    .from("transacoes")
    .select("anuncio_id")
    .eq("id", id)
    .maybeSingle();

  if (!transacao) return;

  await supabase.from("transacoes").update({ status: decisao }).eq("id", id);
  await supabase.from("transacao_eventos").insert({
    transacao_id: id,
    status_anterior: "em_disputa",
    status_novo: decisao,
    ator_id: profile.id,
    observacao: observacao || "Disputa resolvida pela equipe.",
  });

  if (decisao === "reembolsada") {
    // Reembolso significa que a venda não se concretizou: reabre o anúncio.
    await supabase.from("anuncios").update({ status: "publicado" }).eq("id", transacao.anuncio_id);
  }

  revalidatePath("/painel/admin/disputas");
}
