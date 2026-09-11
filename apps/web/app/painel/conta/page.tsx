import { requireProfile } from "@/lib/auth";
import { elegibilidadeParaExclusao } from "@/lib/conta/exclusao";
import { solicitarExclusaoConta } from "./actions";
import type { TransacaoStatus } from "@/lib/transacoes/state-machine";
import type { AnuncioStatus } from "@/lib/supabase/database.types";

const TRANSACAO_STATUS_NAO_TERMINAL: TransacaoStatus[] = [
  "aguardando_pagamento",
  "pagamento_em_escrow",
  "em_transferencia",
  "em_disputa",
];
const ANUNCIO_STATUS_ATIVO: AnuncioStatus[] = ["rascunho", "em_analise", "publicado", "pausado"];

export default async function ContaPage({ searchParams }: { searchParams: { erro?: string; sucesso?: string } }) {
  const { supabase, profile } = await requireProfile();

  const [{ count: transacoesEmAndamento }, { count: anunciosAtivos }] = await Promise.all([
    supabase
      .from("transacoes")
      .select("id", { count: "exact", head: true })
      .or(`comprador_id.eq.${profile.id},vendedor_id.eq.${profile.id}`)
      .in("status", TRANSACAO_STATUS_NAO_TERMINAL),
    supabase
      .from("anuncios")
      .select("id", { count: "exact", head: true })
      .eq("vendedor_id", profile.id)
      .in("status", ANUNCIO_STATUS_ATIVO),
  ]);

  const elegibilidade = elegibilidadeParaExclusao({
    transacoesEmAndamento: transacoesEmAndamento ?? 0,
    anunciosAtivos: anunciosAtivos ?? 0,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Conta e privacidade</h1>

      {searchParams.erro && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{searchParams.erro}</p>}
      {searchParams.sucesso && <p className="rounded bg-green-50 p-2 text-sm text-green-800">{searchParams.sucesso}</p>}

      <div className="rounded border p-4">
        <h2 className="mb-1 text-sm font-medium">Exportar meus dados</h2>
        <p className="mb-3 text-sm text-neutral-600">
          Baixe uma cópia de tudo que temos sobre você: perfil, anúncios, propostas, transações,
          avaliações e mensagens que você enviou.
        </p>
        <a href="/api/conta/exportar" className="inline-block rounded bg-neutral-900 px-4 py-2 text-sm text-white">
          Baixar meus dados (JSON)
        </a>
      </div>

      <div className="rounded border border-red-200 p-4">
        <h2 className="mb-1 text-sm font-medium text-red-800">Excluir minha conta</h2>
        <p className="mb-3 text-sm text-neutral-600">
          Seus dados de identificação são apagados e o login é desabilitado. Isso não pode ser
          desfeito.
        </p>

        {!elegibilidade.elegivel ? (
          <p className="text-sm text-amber-700">
            {elegibilidade.motivo === "transacao_em_andamento"
              ? "Você tem transação em andamento. Finalize ou cancele antes de excluir a conta."
              : "Você tem anúncio ativo. Remova ou aguarde a venda/expiração antes de excluir a conta."}
          </p>
        ) : (
          <form action={solicitarExclusaoConta} className="flex flex-col gap-2">
            <label className="text-sm">
              Digite <strong>EXCLUIR</strong> para confirmar
              <input name="confirmacao" required className="mt-1 w-full rounded border px-3 py-2" />
            </label>
            <button className="rounded bg-red-700 px-4 py-2 text-sm text-white">Excluir minha conta</button>
          </form>
        )}
      </div>
    </main>
  );
}
