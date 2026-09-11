// Lógica pura do cron de expurgo de KYC reprovado, separada do Route
// Handler pelo mesmo motivo do webhook do Pagar.me (ver lib/pagarme/webhook.ts):
// route.ts só pode exportar métodos HTTP, e isso fica testável isoladamente.

import { comparacaoSegura } from "@/lib/seguranca/comparacaoSegura";

export function autenticadoCron(headers: Headers): boolean {
  const secret = process.env.CRON_SECRET;
  const cabecalho = headers.get("authorization");
  if (!secret || !cabecalho) return false;
  return comparacaoSegura(cabecalho, `Bearer ${secret}`);
}

export function dataLimiteRetencao(diasRetencao: number, agora: Date = new Date()): string {
  return new Date(agora.getTime() - diasRetencao * 24 * 60 * 60 * 1000).toISOString();
}
