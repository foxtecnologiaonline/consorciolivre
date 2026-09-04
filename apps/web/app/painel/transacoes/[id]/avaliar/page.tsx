import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { enviarAvaliacao } from "./actions";

export default async function AvaliarPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { erro?: string };
}) {
  const { supabase, profile } = await requireProfile();

  const { data: transacao } = await supabase
    .from("transacoes")
    .select("id, status, comprador_id, vendedor_id, anuncios(titulo)")
    .eq("id", params.id)
    .maybeSingle<any>();

  if (!transacao) notFound();
  if (transacao.comprador_id !== profile.id && transacao.vendedor_id !== profile.id) notFound();

  const { data: jaAvaliou } = await supabase
    .from("avaliacoes")
    .select("id")
    .eq("transacao_id", params.id)
    .eq("autor_id", profile.id)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Avaliar negociação</h1>
      <p className="text-sm text-neutral-600">{transacao.anuncios?.titulo}</p>

      {searchParams.erro && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{searchParams.erro}</p>
      )}

      {transacao.status !== "concluida" && (
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
          Esta transação ainda não foi concluída.
        </p>
      )}

      {transacao.status === "concluida" && jaAvaliou && (
        <p className="rounded bg-green-50 p-3 text-sm text-green-800">Você já avaliou esta negociação.</p>
      )}

      {transacao.status === "concluida" && !jaAvaliou && (
        <form action={enviarAvaliacao} className="flex flex-col gap-3">
          <input type="hidden" name="transacao_id" value={transacao.id} />
          <fieldset className="flex gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="flex items-center gap-1 text-sm">
                <input type="radio" name="nota" value={n} required /> {n}★
              </label>
            ))}
          </fieldset>
          <textarea
            name="comentario"
            placeholder="Comentário (opcional)"
            rows={4}
            className="rounded border px-3 py-2"
          />
          <button type="submit" className="rounded bg-neutral-900 py-2 text-white">
            Enviar avaliação
          </button>
        </form>
      )}
    </main>
  );
}
