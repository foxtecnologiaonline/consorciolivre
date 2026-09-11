export class PercentualInvalidoError extends Error {}

export interface DivisaoDisputa {
  valorVendedorCentavos: number;
  valorCompradorCentavos: number;
}

// Staff define quanto (%) fica com o vendedor na resolução de uma disputa
// por divisão; o restante é devolvido ao comprador. Trabalha em centavos
// para não acumular erro de arredondamento de float — o resto do valor
// total vai inteiro para o comprador, então a soma das duas partes nunca
// diverge do valor original por causa de arredondamento.
export function calcularDivisaoDisputa(valorTotalCentavos: number, percentualVendedor: number): DivisaoDisputa {
  if (!Number.isFinite(percentualVendedor) || percentualVendedor < 0 || percentualVendedor > 100) {
    throw new PercentualInvalidoError("Percentual do vendedor precisa estar entre 0 e 100.");
  }

  const valorVendedorCentavos = Math.round((valorTotalCentavos * percentualVendedor) / 100);
  return {
    valorVendedorCentavos,
    valorCompradorCentavos: valorTotalCentavos - valorVendedorCentavos,
  };
}
