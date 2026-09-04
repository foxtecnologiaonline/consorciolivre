import Link from "next/link";
import { requireProfile } from "@/lib/auth";

export default async function ChatListaPage() {
  const { supabase, profile } = await requireProfile();

  const { data: threads } = await supabase
    .from("chat_threads")
    .select(
      "id, criado_em, comprador_id, vendedor_id, anuncios(titulo), comprador:profiles!chat_threads_comprador_id_fkey(nome_completo)"
    )
    .or(`comprador_id.eq.${profile.id},vendedor_id.eq.${profile.id}`)
    .order("criado_em", { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Conversas</h1>

      {(!threads || threads.length === 0) && (
        <p className="text-sm text-neutral-600">Nenhuma conversa ainda.</p>
      )}

      <ul className="flex flex-col gap-3">
        {threads?.map((t: any) => (
          <li key={t.id} className="rounded border p-4 hover:bg-neutral-50">
            <Link href={`/painel/chat/${t.id}`} className="flex flex-col">
              <span className="font-medium">{t.anuncios?.titulo}</span>
              <span className="text-sm text-neutral-600">
                {t.comprador_id === profile.id ? "Com o vendedor" : `Com ${t.comprador?.nome_completo}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
