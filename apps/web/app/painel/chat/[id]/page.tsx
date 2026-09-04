import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ChatRealtime } from "@/components/ChatRealtime";
import { enviarMensagem } from "./actions";

export default async function ChatThreadPage({ params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();

  const { data: thread } = await supabase
    .from("chat_threads")
    .select("id, comprador_id, vendedor_id, anuncios(id, titulo)")
    .eq("id", params.id)
    .maybeSingle<any>();

  if (!thread) notFound();
  if (thread.comprador_id !== user.id && thread.vendedor_id !== user.id) notFound();

  const { data: mensagens } = await supabase
    .from("chat_mensagens")
    .select("id, autor_id, conteudo, criado_em")
    .eq("thread_id", params.id)
    .order("criado_em", { ascending: true });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
      <Link href={`/anuncios/${thread.anuncios?.id}`} className="text-sm text-neutral-600 hover:underline">
        ← {thread.anuncios?.titulo}
      </Link>
      <h1 className="text-xl font-semibold">Conversa</h1>

      <ChatRealtime
        threadId={params.id}
        userId={user.id}
        mensagensIniciais={mensagens ?? []}
        enviarMensagem={enviarMensagem}
      />
    </main>
  );
}
