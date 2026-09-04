import { requireProfile } from "@/lib/auth";
import { aceitarProposta, recusarProposta } from "./actions";

export default async function PropostasPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const { supabase, profile } = await requireProfile();

  const [{ data: recebidas }, { data: enviadas }] = await Promise.all([
    supabase
      .from("propostas")
      .select("id, valor, status, criado_em, comprador_id, anuncios!inner(titulo, vendedor_id), profiles!propostas_comprador_id_fkey(nome_completo)")
      .eq("anuncios.vendedor_id", profile.id)
      .order("criado_em", { ascending: false }),
    supabase
      .from("propostas")
      .select("id, valor, status, criado_em, anuncio_id, anuncios(titulo)")
      .eq("comprador_id", profile.id)
      .order("criado_em", { ascending: false }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Propostas</h1>

      {searchParams.erro && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{searchParams.erro}</p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Recebidas (como vendedor)</h2>
        {(!recebidas || recebidas.length === 0) && (
          <p className="text-sm text-neutral-600">Nenhuma proposta recebida.</p>
        )}
        <ul className="flex flex-col gap-3">
          {recebidas?.map((p: any) => (
            <li key={p.id} className="rounded border p-4">
              <p className="font-medium">{p.anuncios.titulo}</p>
              <p className="text-sm text-neutral-600">
                {p.profiles?.nome_completo} propôs{" "}
                {p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {p.status}
              </p>
              {p.status === "pendente" && (
                <div className="mt-2 flex gap-2">
                  <form action={aceitarProposta}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="rounded bg-green-700 px-3 py-1.5 text-sm text-white">Aceitar</button>
                  </form>
                  <form action={recusarProposta}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="rounded bg-red-700 px-3 py-1.5 text-sm text-white">Recusar</button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Enviadas (como comprador)</h2>
        {(!enviadas || enviadas.length === 0) && (
          <p className="text-sm text-neutral-600">Você ainda não enviou propostas.</p>
        )}
        <ul className="flex flex-col gap-3">
          {enviadas?.map((p: any) => (
            <li key={p.id} className="rounded border p-4">
              <p className="font-medium">{p.anuncios?.titulo}</p>
              <p className="text-sm text-neutral-600">
                {p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {p.status}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
