"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { estornarEscrow, liberarEscrow } from "@/lib/pagamentos/escrow";

// "Dividir" o valor entre comprador e vendedor (mencionado em
// docs/ARCHITECTURE.md §4.4) fica fora deste item: exigiria um valor parcial
// e um status novo que a UI/schema atuais não têm — decisão aqui é sempre
// liberar ou estornar o valor total (fase 2.1 trata split parcial).
export async function resolverDisputa(formData: FormData) {
  const { supabase, profile } = await requireStaff();

  const id = String(formData.get("id"));
  const decisao = String(formData.get("decisao")) as "concluida" | "reembolsada";
  const observacao = String(formData.get("observacao") ?? "").trim();

  const { data: transacao } = await supabase
    .from("transacoes")
    .select("anuncio_id, vendedor_id, valor_acordado, comissao_valor")
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
    // Reembolso significa que a venda não se concretizou: reabre o anúncio e
    // estorna o pagamento retido (nunca chegou a ser repassado ao vendedor).
    await supabase.from("anuncios").update({ status: "publicado" }).eq("id", transacao.anuncio_id);
    await estornarEscrow(id);
  } else {
    await liberarEscrow(id, transacao.vendedor_id, transacao.valor_acordado - transacao.comissao_valor);
  }

  revalidatePath("/painel/admin/disputas");
}
