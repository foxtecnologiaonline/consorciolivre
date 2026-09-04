"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

// Sinaliza tentativa de trocar contato fora da plataforma (telefone, e-mail, @usuário
// de outro app) — não bloqueia a mensagem no MVP, só marca para moderação futura,
// conforme a estratégia antifraude descrita em docs/ARCHITECTURE.md.
const PADRAO_CONTATO_EXTERNO = /(\d{2}\s?\)?\s?9?\d{4}[-\s]?\d{4})|(@\w+)|([\w.+-]+@[\w-]+\.[a-z]{2,})|whats\s?app/i;

export async function enviarMensagem(formData: FormData) {
  const { supabase, user } = await requireUser();

  const threadId = String(formData.get("thread_id"));
  const conteudo = String(formData.get("conteudo") ?? "").trim();

  if (!conteudo) return;

  const { data: thread } = await supabase
    .from("chat_threads")
    .select("id, comprador_id, vendedor_id")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread || (thread.comprador_id !== user.id && thread.vendedor_id !== user.id)) return;

  await supabase.from("chat_mensagens").insert({
    thread_id: threadId,
    autor_id: user.id,
    conteudo,
    sinalizada: PADRAO_CONTATO_EXTERNO.test(conteudo),
  });

  revalidatePath(`/painel/chat/${threadId}`);
}
