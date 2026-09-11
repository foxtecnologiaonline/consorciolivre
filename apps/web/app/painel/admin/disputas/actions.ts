"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { dividirEscrow, estornarEscrow, liberarEscrow } from "@/lib/pagamentos/escrow";
import { PercentualInvalidoError } from "@/lib/pagamentos/divisao";

export async function resolverDisputa(formData: FormData) {
  const { supabase, profile } = await requireStaff();

  const id = String(formData.get("id"));
  const decisao = String(formData.get("decisao")) as "concluida" | "reembolsada" | "dividida";
  const observacao = String(formData.get("observacao") ?? "").trim();

  const { data: transacao } = await supabase
    .from("transacoes")
    .select("anuncio_id, vendedor_id, valor_acordado, comissao_valor")
    .eq("id", id)
    .maybeSingle();

  if (!transacao) return;

  let percentualVendedor = 0;
  if (decisao === "dividida") {
    percentualVendedor = Number(formData.get("percentual_vendedor"));
    if (!Number.isFinite(percentualVendedor) || percentualVendedor < 0 || percentualVendedor > 100) {
      redirect("/painel/admin/disputas?erro=" + encodeURIComponent("Percentual do vendedor precisa estar entre 0 e 100."));
    }
  }

  await supabase.from("transacoes").update({ status: decisao }).eq("id", id);
  await supabase.from("transacao_eventos").insert({
    transacao_id: id,
    status_anterior: "em_disputa",
    status_novo: decisao,
    ator_id: profile.id,
    observacao:
      observacao ||
      (decisao === "dividida" ? `Disputa dividida pela equipe: ${percentualVendedor}% ao vendedor.` : "Disputa resolvida pela equipe."),
  });

  if (decisao === "reembolsada") {
    // Reembolso significa que a venda não se concretizou: reabre o anúncio e
    // estorna o pagamento retido (nunca chegou a ser repassado ao vendedor).
    await supabase.from("anuncios").update({ status: "publicado" }).eq("id", transacao.anuncio_id);
    await estornarEscrow(id);
  } else if (decisao === "dividida") {
    // Divisão não faz suposição sobre a posse da cota (ver
    // lib/pagamentos/escrow.ts) — staff decide separadamente, pelo painel de
    // anúncios, se o anúncio deve ser reaberto.
    try {
      await dividirEscrow(id, transacao.vendedor_id, transacao.valor_acordado, percentualVendedor);
    } catch (erro) {
      if (!(erro instanceof PercentualInvalidoError)) throw erro;
    }
  } else {
    await liberarEscrow(id, transacao.vendedor_id, transacao.valor_acordado - transacao.comissao_valor);
  }

  revalidatePath("/painel/admin/disputas");
}
