import Link from "next/link";
import { requireProfile } from "@/lib/auth";

const STATUS_LABEL: Record<string, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pagamento_em_escrow: "Pagamento confirmado (aguardando transferência)",
  em_transferencia: "Em transferência na administradora",
  concluida: "Concluída",
  cancelada: "Cancelada",
  em_disputa: "Em disputa",
  reembolsada: "Reembolsada",
};

export default async function TransacoesPage() {
  const { supabase, profile } = await requireProfile();

  const { data: transacoes } = await supabase
    .from("transacoes")
    .select("id, valor_acordado, status, criado_em, comprador_id, vendedor_id, anuncios(titulo)")
    .or(`comprador_id.eq.${profile.id},vendedor_id.eq.${profile.id}`)
    .order("criado_em", { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Minhas transações</h1>

      {(!transacoes || transacoes.length === 0) && (
        <p className="text-sm text-neutral-600">Nenhuma transação ainda.</p>
      )}

      <ul className="flex flex-col gap-3">
        {transacoes?.map((t: any) => (
          <li key={t.id} className="rounded border p-4">
            <Link href={`/painel/transacoes/${t.id}`} className="font-medium hover:underline">
              {t.anuncios?.titulo}
            </Link>
            <p className="text-sm text-neutral-600">
              {t.comprador_id === profile.id ? "Como comprador" : "Como vendedor"} ·{" "}
              {t.valor_acordado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
            <p className="text-sm">{STATUS_LABEL[t.status]}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
