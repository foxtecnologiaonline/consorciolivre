import { describe, expect, it } from "vitest";
import { elegibilidadeParaPublicar } from "./elegibilidade";

describe("elegibilidadeParaPublicar", () => {
  it("libera quando KYC está aprovado e há recebedor no Pagar.me", () => {
    const resultado = elegibilidadeParaPublicar({
      kycStatus: "aprovado",
      pagarmeRecipientId: "rp_123",
    });
    expect(resultado).toEqual({ elegivel: true });
  });

  it("bloqueia por KYC pendente mesmo com recebedor cadastrado", () => {
    const resultado = elegibilidadeParaPublicar({
      kycStatus: "em_analise",
      pagarmeRecipientId: "rp_123",
    });
    expect(resultado).toEqual({ elegivel: false, motivo: "kyc_pendente" });
  });

  it("bloqueia por falta de conta bancária/recebedor mesmo com KYC aprovado", () => {
    const resultado = elegibilidadeParaPublicar({
      kycStatus: "aprovado",
      pagarmeRecipientId: null,
    });
    expect(resultado).toEqual({ elegivel: false, motivo: "sem_conta_bancaria" });
  });
});
