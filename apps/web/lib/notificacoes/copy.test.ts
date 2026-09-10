import { describe, expect, it } from "vitest";
import { notificacaoRevisaoKyc } from "./copy";

describe("notificacaoRevisaoKyc", () => {
  it("monta a notificação de aprovação", () => {
    expect(notificacaoRevisaoKyc("aprovado", null)).toEqual({
      tipo: "documento_aprovado",
      titulo: "Verificação aprovada",
      corpo: "Sua identidade foi verificada. Você já pode publicar anúncios.",
    });
  });

  it("monta a notificação de reprovação com o motivo informado por staff", () => {
    expect(notificacaoRevisaoKyc("reprovado", "Foto do documento ilegível.")).toEqual({
      tipo: "documento_reprovado",
      titulo: "Verificação reprovada",
      corpo: "Sua verificação foi reprovada. Foto do documento ilegível.",
    });
  });

  it("usa mensagem padrão quando staff reprova sem motivo", () => {
    expect(notificacaoRevisaoKyc("reprovado", null).corpo).toBe(
      "Sua verificação foi reprovada. Envie os documentos novamente."
    );
  });
});
