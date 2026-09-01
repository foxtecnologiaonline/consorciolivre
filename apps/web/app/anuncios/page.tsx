import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { TipoBem } from "@/lib/supabase/database.types";

const TIPO_BEM_LABEL: Record<TipoBem, string> = {
  imovel: "Imóvel",
  veiculo: "Veículo",
  moto: "Moto",
  servico: "Serviço",
  pesados: "Pesados",
};

function parseTipoBem(value: string | undefined): TipoBem | undefined {
  return value && value in TIPO_BEM_LABEL ? (value as TipoBem) : undefined;
}

export default async function BuscaAnunciosPage({
  searchParams,
}: {
  searchParams: { q?: string; tipo_bem?: string; administradora_id?: string };
}) {
  const supabase = createClient();

  const { data: administradoras } = await supabase.from("administradoras").select("id, nome").order("nome");

  let query = supabase
    .from("anuncios")
    .select(
      "id, titulo, preco, criado_em, cotas!inner(tipo_bem, administradora_id, administradoras(nome))"
    )
    .eq("status", "publicado")
    .order("criado_em", { ascending: false })
    .limit(30);

  const tipoBem = parseTipoBem(searchParams.tipo_bem);

  if (searchParams.q) query = query.ilike("titulo", `%${searchParams.q}%`);
  if (tipoBem) query = query.eq("cotas.tipo_bem", tipoBem);
  if (searchParams.administradora_id) query = query.eq("cotas.administradora_id", searchParams.administradora_id);

  const { data: anuncios, error } = await query;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cartas de consórcio</h1>
        <Link href="/painel" className="text-sm underline">
          Minha conta
        </Link>
      </div>

      <form className="flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={searchParams.q}
          placeholder="Buscar por título..."
          className="min-w-[200px] flex-1 rounded border px-3 py-2"
        />
        <select name="tipo_bem" defaultValue={searchParams.tipo_bem ?? ""} className="rounded border px-3 py-2">
          <option value="">Todos os bens</option>
          {Object.entries(TIPO_BEM_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="administradora_id"
          defaultValue={searchParams.administradora_id ?? ""}
          className="rounded border px-3 py-2"
        >
          <option value="">Todas as administradoras</option>
          {administradoras?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">
          Filtrar
        </button>
      </form>

      {error && <p className="text-sm text-red-700">{error.message}</p>}

      {anuncios && anuncios.length === 0 && (
        <p className="text-sm text-neutral-600">Nenhum anúncio encontrado com esses filtros.</p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {anuncios?.map((a: any) => (
          <li key={a.id} className="rounded border p-4">
            <Link href={`/anuncios/${a.id}`} className="font-medium hover:underline">
              {a.titulo}
            </Link>
            <p className="text-sm text-neutral-600">
              {a.cotas?.administradoras?.nome} · {TIPO_BEM_LABEL[a.cotas?.tipo_bem as TipoBem]}
            </p>
            <p className="mt-1 font-semibold">
              {a.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
