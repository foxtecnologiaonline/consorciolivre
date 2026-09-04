"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mensagem = {
  id: string;
  autor_id: string;
  conteudo: string;
  criado_em: string;
};

export function ChatRealtime({
  threadId,
  userId,
  mensagensIniciais,
  enviarMensagem,
}: {
  threadId: string;
  userId: string;
  mensagensIniciais: Mensagem[];
  enviarMensagem: (formData: FormData) => void;
}) {
  const [mensagens, setMensagens] = useState(mensagensIniciais);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`chat_thread_${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_mensagens", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const nova = payload.new as Mensagem;
          setMensagens((atuais) => (atuais.some((m) => m.id === nova.id) ? atuais : [...atuais, nova]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length]);

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex max-h-[60vh] flex-1 flex-col gap-2 overflow-y-auto rounded border p-3">
        {mensagens.length === 0 && <p className="text-sm text-neutral-500">Diga oi para começar a conversa.</p>}
        {mensagens.map((m) => (
          <div
            key={m.id}
            className={`max-w-[75%] rounded px-3 py-2 text-sm ${
              m.autor_id === userId ? "self-end bg-neutral-900 text-white" : "self-start bg-neutral-100"
            }`}
          >
            {m.conteudo}
          </div>
        ))}
        <div ref={fimRef} />
      </div>

      <form
        action={(formData) => {
          enviarMensagem(formData);
          const input = formData.get("conteudo");
          if (typeof input === "string") {
            setMensagens((atuais) => [
              ...atuais,
              {
                id: `otimista-${Date.now()}`,
                autor_id: userId,
                conteudo: input,
                criado_em: new Date().toISOString(),
              },
            ]);
          }
        }}
        className="flex gap-2"
      >
        <input type="hidden" name="thread_id" value={threadId} />
        <input
          name="conteudo"
          placeholder="Escreva uma mensagem..."
          required
          autoComplete="off"
          className="flex-1 rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">
          Enviar
        </button>
      </form>
    </div>
  );
}
