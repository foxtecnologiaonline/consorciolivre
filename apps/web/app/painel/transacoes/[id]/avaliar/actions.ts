"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export async function enviarAvaliacao(formData: FormData) {
  const { supabase, profile } = await requireProfile();

  const transacaoId = String(formData.get("transacao_id"));
  const nota = Number(formData.get("nota"));
  const comentario = String(formData.get("comentario") ?? "").trim();

  const { data: transacao } = await supabase
    .from("transacoes")
    .select("id, status, comprador_id, vendedor_id")
    .eq("id", transacaoId)
    .maybeSingle();

  if (!transacao || transacao.status !== "concluida") {
    redirect(`/painel/transacoes/${transacaoId}?erro=` + encodeURIComponent("Só é possível avaliar transações concluídas."));
  }

  const ehComprador = transacao!.comprador_id === profile.id;
  const ehVendedor = transacao!.vendedor_id === profile.id;

  if (!ehComprador && !ehVendedor) {
    redirect(`/painel/transacoes/${transacaoId}?erro=` + encodeURIComponent("Ação não permitida."));
  }

  if (!nota || nota < 1 || nota > 5) {
    redirect(`/painel/transacoes/${transacaoId}/avaliar?erro=` + encodeURIComponent("Escolha uma nota de 1 a 5."));
  }

  const alvoId = ehComprador ? transacao!.vendedor_id : transacao!.comprador_id;

  const { error } = await supabase.from("avaliacoes").insert({
    transacao_id: transacaoId,
    autor_id: profile.id,
    alvo_id: alvoId,
    nota,
    comentario: comentario || null,
  });

  if (error) redirect(`/painel/transacoes/${transacaoId}/avaliar?erro=${encodeURIComponent(error.message)}`);

  redirect(`/painel/transacoes/${transacaoId}?sucesso=` + encodeURIComponent("Avaliação enviada. Obrigado!"));
}
