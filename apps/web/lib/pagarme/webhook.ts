// Lógica pura de interpretação do webhook do Pagar.me, separada de
// app/api/webhooks/pagarme/route.ts porque um Route Handler do Next.js só
// pode exportar os métodos HTTP (e alguns campos de config) — qualquer outro
// export quebra o build ("does not match the required types of a Next.js
// Route"). Fica aqui, testável isoladamente.
//
// IMPORTANTE: sem acesso a docs.pagar.me nem a uma conta de sandbox neste
// ambiente (ver lib/pagarme/client.ts), o formato exato do payload de eventos
// (nomes de `type`, aninhamento de `data`) não pôde ser validado contra a API
// real. `extrairIdPedido`/`eventoIndicaPago` tentam alguns formatos
// plausíveis, mas isso precisa ser confirmado com um evento real do sandbox
// antes de ir para produção.

import { comparacaoSegura } from "@/lib/seguranca/comparacaoSegura";

export interface PagarmeWebhookPayload {
  type?: string;
  data?: {
    id?: string;
    status?: string;
    order?: { id?: string };
    order_id?: string;
    charges?: Array<{ status?: string }>;
  };
}

export function autenticado(headers: Headers): boolean {
  const usuario = process.env.PAGARME_WEBHOOK_USER;
  const senha = process.env.PAGARME_WEBHOOK_PASSWORD;
  if (!usuario || !senha) return false;

  const cabecalho = headers.get("authorization") ?? "";
  const [esquema, credenciais] = cabecalho.split(" ");
  if (esquema !== "Basic" || !credenciais) return false;

  let decodificado: string;
  try {
    decodificado = Buffer.from(credenciais, "base64").toString("utf-8");
  } catch {
    return false;
  }
  return comparacaoSegura(decodificado, `${usuario}:${senha}`);
}

export function extrairIdPedido(payload: PagarmeWebhookPayload): string | null {
  return payload.data?.id ?? payload.data?.order?.id ?? payload.data?.order_id ?? null;
}

export function eventoIndicaPago(payload: PagarmeWebhookPayload): boolean {
  const tipo = payload.type ?? "";
  const status = payload.data?.status ?? payload.data?.charges?.[0]?.status;
  return tipo.includes("paid") || status === "paid";
}
