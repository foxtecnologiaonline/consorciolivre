import { timingSafeEqual } from "node:crypto";

// Comparação de segredos (Basic Auth do webhook, Bearer do cron) em tempo
// constante — string `===` vaza quanto do prefixo bateu através do tempo de
// resposta. timingSafeEqual exige buffers do mesmo tamanho, por isso o
// comprimento é comparado primeiro (não é sensível: só denuncia que o
// segredo tem tamanho diferente, nunca qual caractere diverge).
export function comparacaoSegura(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf-8");
  const bufferB = Buffer.from(b, "utf-8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
