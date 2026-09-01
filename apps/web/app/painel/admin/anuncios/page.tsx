import { requireStaff } from "@/lib/auth";
import { revisarAnuncio } from "./actions";

export default async function AdminAnunciosPage() {
  const { supabase } = await requireStaff();

  const { data: pendentes } = await supabase
    .from("anuncios")
    .select("id, titulo, preco, descricao, criado_em, profiles(nome_completo), cotas(numero_grupo, numero_cota, administradoras(nome))")
    .eq("status", "em_analise")
    .order("criado_em", { ascending: true });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Anúncios pendentes</h1>

      {(!pendentes || pendentes.length === 0) && (
        <p className="text-sm text-neutral-600">Nenhum anúncio pendente.</p>
      )}

      <ul className="flex flex-col gap-4">
        {pendentes?.map((a: any) => (
          <li key={a.id} className="rounded border p-4">
            <p className="font-medium">{a.titulo}</p>
            <p className="text-sm text-neutral-600">
              Vendedor: {a.profiles?.nome_completo} · {a.cotas?.administradoras?.nome} — grupo{" "}
              {a.cotas?.numero_grupo} / cota {a.cotas?.numero_cota}
            </p>
            <p className="text-sm">{a.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
            {a.descricao && <p className="mt-1 text-sm text-neutral-700">{a.descricao}</p>}

            <form action={revisarAnuncio} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="id" value={a.id} />
              <input
                name="motivo_reprovacao"
                placeholder="Motivo (se for reprovar)"
                className="rounded border px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  name="decisao"
                  value="publicado"
                  className="rounded bg-green-700 px-4 py-2 text-sm text-white"
                >
                  Publicar
                </button>
                <button
                  name="decisao"
                  value="reprovado"
                  className="rounded bg-red-700 px-4 py-2 text-sm text-white"
                >
                  Reprovar
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
