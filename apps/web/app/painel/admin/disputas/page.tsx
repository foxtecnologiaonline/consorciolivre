import { requireStaff } from "@/lib/auth";
import { resolverDisputa } from "./actions";

export default async function AdminDisputasPage() {
  const { supabase } = await requireStaff();

  const { data: disputas } = await supabase
    .from("transacoes")
    .select(
      "id, valor_acordado, criado_em, anuncios(titulo), comprador:profiles!transacoes_comprador_id_fkey(nome_completo), vendedor:profiles!transacoes_vendedor_id_fkey(nome_completo)"
    )
    .eq("status", "em_disputa")
    .order("criado_em", { ascending: true });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Disputas abertas</h1>

      {(!disputas || disputas.length === 0) && (
        <p className="text-sm text-neutral-600">Nenhuma disputa aberta no momento.</p>
      )}

      <ul className="flex flex-col gap-4">
        {disputas?.map((d: any) => (
          <li key={d.id} className="rounded border p-4">
            <p className="font-medium">{d.anuncios?.titulo}</p>
            <p className="text-sm text-neutral-600">
              Comprador: {d.comprador?.nome_completo} · Vendedor: {d.vendedor?.nome_completo}
            </p>
            <p className="text-sm">{d.valor_acordado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>

            <form action={resolverDisputa} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="id" value={d.id} />
              <input name="observacao" placeholder="Justificativa da decisão" className="rounded border px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <button name="decisao" value="concluida" className="rounded bg-green-700 px-4 py-2 text-sm text-white">
                  Liberar ao vendedor (concluir)
                </button>
                <button name="decisao" value="reembolsada" className="rounded bg-red-700 px-4 py-2 text-sm text-white">
                  Reembolsar comprador
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
