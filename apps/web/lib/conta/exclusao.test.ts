import { describe, expect, it } from "vitest";
import { elegibilidadeParaExclusao } from "./exclusao";

describe("elegibilidadeParaExclusao", () => {
  it("libera exclusão quando não há transação ou anúncio em andamento", () => {
    expect(elegibilidadeParaExclusao({ transacoesEmAndamento: 0, anunciosAtivos: 0 })).toEqual({ elegivel: true });
  });

  it("bloqueia por transação em andamento, mesmo sem anúncio ativo", () => {
    expect(elegibilidadeParaExclusao({ transacoesEmAndamento: 1, anunciosAtivos: 0 })).toEqual({
      elegivel: false,
      motivo: "transacao_em_andamento",
    });
  });

  it("bloqueia por anúncio ativo quando não há transação em andamento", () => {
    expect(elegibilidadeParaExclusao({ transacoesEmAndamento: 0, anunciosAtivos: 2 })).toEqual({
      elegivel: false,
      motivo: "anuncio_ativo",
    });
  });
});
