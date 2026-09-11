import { describe, expect, it } from "vitest";
import { PercentualInvalidoError, calcularDivisaoDisputa } from "./divisao";

describe("calcularDivisaoDisputa", () => {
  it("divide 60% para o vendedor e o resto para o comprador", () => {
    expect(calcularDivisaoDisputa(100000, 60)).toEqual({
      valorVendedorCentavos: 60000,
      valorCompradorCentavos: 40000,
    });
  });

  it("nunca perde centavo por arredondamento — a soma das partes é igual ao total", () => {
    const resultado = calcularDivisaoDisputa(100001, 33);
    expect(resultado.valorVendedorCentavos + resultado.valorCompradorCentavos).toBe(100001);
  });

  it("0% devolve tudo ao comprador", () => {
    expect(calcularDivisaoDisputa(50000, 0)).toEqual({ valorVendedorCentavos: 0, valorCompradorCentavos: 50000 });
  });

  it("100% libera tudo ao vendedor", () => {
    expect(calcularDivisaoDisputa(50000, 100)).toEqual({ valorVendedorCentavos: 50000, valorCompradorCentavos: 0 });
  });

  it("rejeita percentual fora do intervalo 0-100", () => {
    expect(() => calcularDivisaoDisputa(50000, 150)).toThrow(PercentualInvalidoError);
    expect(() => calcularDivisaoDisputa(50000, -10)).toThrow(PercentualInvalidoError);
  });
});
