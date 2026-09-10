import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Cliente com service_role: contorna RLS e as triggers de proteção de coluna
// (ver supabase/migrations/0005_pagarme_recebedor.sql). Só para Server
// Actions/Route Handlers que precisam escrever em colunas que o próprio
// usuário logado não pode tocar (profiles.pagarme_recipient_id, .role,
// .suspenso). Nunca importar em código que roda no client nem em Server
// Components que só leem dados do usuário logado — para isso, use
// lib/supabase/server.ts.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
