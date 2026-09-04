-- Supabase só emite eventos Realtime para tabelas explicitamente adicionadas à
-- publicação supabase_realtime. Sem isso, o chat funciona mas nunca atualiza ao
-- vivo (ChatRealtime.tsx assina postgres_changes em chat_mensagens).
alter publication supabase_realtime add table chat_mensagens;
