import { describe, expect, it } from "vitest";
import { comparacaoSegura } from "./comparacaoSegura";

describe("comparacaoSegura", () => {
  it("retorna true para strings idênticas", () => {
    expect(comparacaoSegura("segredo-123", "segredo-123")).toBe(true);
  });

  it("retorna false para strings de tamanhos diferentes sem lançar erro", () => {
    expect(comparacaoSegura("segredo-123", "seg")).toBe(false);
  });

  it("retorna false para strings do mesmo tamanho mas conteúdo diferente", () => {
    expect(comparacaoSegura("segredo-123", "segredo-456")).toBe(false);
  });
});
