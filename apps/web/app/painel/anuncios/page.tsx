import Link from "next/link";
import { requireProfile } from "@/lib/auth";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_analise: "Em análise",
  publicado: "Publicado",
  pausado: "Pausado",
  vendido: "Vendido",
  reprovado: "Reprovado",
  expirado: "Expirado",
};

export default async function MeusAnunciosPage() {
  const { supabase, profile } = await requireProfile();

  const { data: anuncios } = await supabase
    .from("anuncios")
    .select("id, titulo, preco, status, motivo_reprovacao, criado_em")
    .eq("vendedor_id", profile.id)
    .order("criado_em", { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Meus anúncios</h1>
        <Link href="/painel/anuncios/novo" className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">
          Novo anúncio
        </Link>
      </div>

      {(!anuncios || anuncios.length === 0) && (
        <p className="text-sm text-neutral-600">Você ainda não publicou nenhum anúncio.</p>
      )}

      <ul className="flex flex-col gap-3">
        {anuncios?.map((a) => (
          <li key={a.id} className="rounded border p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{a.titulo}</span>
              <span className="text-sm text-neutral-600">{STATUS_LABEL[a.status]}</span>
            </div>
            <p className="text-sm text-neutral-600">
              {a.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
            {a.motivo_reprovacao && <p className="text-sm text-red-700">{a.motivo_reprovacao}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
