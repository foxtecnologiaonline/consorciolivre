"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { dividirEscrow, estornarEscrow, liberarEscrow } from "@/lib/pagamentos/escrow";
import { PercentualInvalidoError } from "@/lib/pagamentos/divisao";

const DECISOES_VALIDAS = ["concluida", "reembolsada", "dividida"] as const;
type Decisao = (typeof DECISOES_VALIDAS)[number];

export async function resolverDisputa(formData: FormData) {
  const { supabase, profile } = await requireStaff();

  const id = String(formData.get("id"));
  const decisaoBruta = String(formData.get("decisao"));
  const observacao = String(formData.get("observacao") ?? "").trim();

  // Sem isso, qualquer valor inesperado em "decisao" cairia no `else` de
  // liberarEscrow (fail-open liberando dinheiro ao vendedor) mesmo que o
  // UPDATE em transacoes tivesse falhado silenciosamente na constraint de
  // status. Nunca assumir "senão deve ser concluída" numa ação que move
  // dinheiro de verdade.
  if (!DECISOES_VALIDAS.includes(decisaoBruta as Decisao)) {
    redirect("/painel/admin/disputas?erro=" + encodeURIComponent("Decisão inválida."));
  }
  const decisao = decisaoBruta as Decisao;

  const { data: transacao } = await supabase
    .from("transacoes")
    .select("status, anuncio_id, vendedor_id, valor_acordado, comissao_valor")
    .eq("id", id)
    .maybeSingle();

  if (!transacao) return;

  // Idempotência: uma disputa já resolvida (segundo clique, página não
  // revalidada, requisição duplicada) não pode sobrescrever o status final
  // nem reabrir o anúncio de uma transação que já foi paga/estornada — as
  // funções de escrow até se protegem sozinhas (só agem sobre `pagamentos`
  // ainda 'confirmado'), mas sem essa guarda o `transacoes.status` e o
  // `anuncios.status` seriam sobrescritos mesmo assim.
  if (transacao.status !== "em_disputa") {
    redirect("/painel/admin/disputas?erro=" + encodeURIComponent("Esta disputa já foi resolvida."));
  }

  let percentualVendedor = 0;
  if (decisao === "dividida") {
    percentualVendedor = Number(formData.get("percentual_vendedor"));
    if (!Number.isFinite(percentualVendedor) || percentualVendedor < 0 || percentualVendedor > 100) {
      redirect("/painel/admin/disputas?erro=" + encodeURIComponent("Percentual do vendedor precisa estar entre 0 e 100."));
    }
  }

  const { error: erroTransacao } = await supabase.from("transacoes").update({ status: decisao }).eq("id", id);
  if (erroTransacao) {
    redirect("/painel/admin/disputas?erro=" + encodeURIComponent(erroTransacao.message));
  }

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
