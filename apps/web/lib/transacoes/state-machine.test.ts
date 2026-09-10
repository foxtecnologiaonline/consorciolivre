import { describe, expect, it } from "vitest";
import {
  TransicaoInvalidaError,
  abrirDisputa,
  cancelarTransacao,
  confirmarRecebimento,
  confirmarTransferencia,
  marcarPagamentoRealizado,
  type Transacao,
} from "./state-machine";

const COMPRADOR_ID = "comprador-1";
const VENDEDOR_ID = "vendedor-1";
const OUTRO_USUARIO_ID = "outro-usuario";

function criarTransacao(status: Transacao["status"]): Transacao {
  return { status, compradorId: COMPRADOR_ID, vendedorId: VENDEDOR_ID };
}

describe("marcarPagamentoRealizado", () => {
  it("comprador confirma pagamento e a transação vai para pagamento_em_escrow", () => {
    const transacao = criarTransacao("aguardando_pagamento");
    const resultado = marcarPagamentoRealizado(transacao, COMPRADOR_ID);
    expect(resultado).toEqual({ statusAnterior: "aguardando_pagamento", statusNovo: "pagamento_em_escrow" });
  });

  it("rejeita quando não é o comprador quem confirma", () => {
    const transacao = criarTransacao("aguardando_pagamento");
    expect(() => marcarPagamentoRealizado(transacao, VENDEDOR_ID)).toThrow(TransicaoInvalidaError);
  });

  it("rejeita quando o status já não é aguardando_pagamento", () => {
    const transacao = criarTransacao("pagamento_em_escrow");
    expect(() => marcarPagamentoRealizado(transacao, COMPRADOR_ID)).toThrow(TransicaoInvalidaError);
  });
});

describe("confirmarRecebimento", () => {
  it("vendedor confirma recebimento e a transação vai para em_transferencia", () => {
    const transacao = criarTransacao("pagamento_em_escrow");
    const resultado = confirmarRecebimento(transacao, VENDEDOR_ID);
    expect(resultado).toEqual({ statusAnterior: "pagamento_em_escrow", statusNovo: "em_transferencia" });
  });

  it("rejeita quando não é o vendedor quem confirma", () => {
    const transacao = criarTransacao("pagamento_em_escrow");
    expect(() => confirmarRecebimento(transacao, COMPRADOR_ID)).toThrow(TransicaoInvalidaError);
  });
});

describe("confirmarTransferencia", () => {
  it("comprador confirma transferência e a transação é concluída", () => {
    const transacao = criarTransacao("em_transferencia");
    const resultado = confirmarTransferencia(transacao, COMPRADOR_ID);
    expect(resultado).toEqual({ statusAnterior: "em_transferencia", statusNovo: "concluida" });
  });

  it("rejeita confirmação de transferência fora de em_transferencia", () => {
    const transacao = criarTransacao("pagamento_em_escrow");
    expect(() => confirmarTransferencia(transacao, COMPRADOR_ID)).toThrow(TransicaoInvalidaError);
  });
});

describe("abrirDisputa", () => {
  it.each(["pagamento_em_escrow", "em_transferencia"] as const)(
    "comprador ou vendedor pode abrir disputa a partir de %s",
    (status) => {
      const transacao = criarTransacao(status);
      const resultado = abrirDisputa(transacao, VENDEDOR_ID);
      expect(resultado).toEqual({ statusAnterior: status, statusNovo: "em_disputa" });
    }
  );

  it("rejeita disputa antes de qualquer pagamento", () => {
    const transacao = criarTransacao("aguardando_pagamento");
    expect(() => abrirDisputa(transacao, COMPRADOR_ID)).toThrow(TransicaoInvalidaError);
  });

  it("rejeita disputa aberta por quem não é parte da transação", () => {
    const transacao = criarTransacao("pagamento_em_escrow");
    expect(() => abrirDisputa(transacao, OUTRO_USUARIO_ID)).toThrow(TransicaoInvalidaError);
  });
});

describe("cancelarTransacao", () => {
  it("comprador ou vendedor cancela antes do pagamento", () => {
    const transacao = criarTransacao("aguardando_pagamento");
    const resultado = cancelarTransacao(transacao, COMPRADOR_ID);
    expect(resultado).toEqual({ statusAnterior: "aguardando_pagamento", statusNovo: "cancelada" });
  });

  it("rejeita cancelamento depois do pagamento em escrow", () => {
    const transacao = criarTransacao("pagamento_em_escrow");
    expect(() => cancelarTransacao(transacao, COMPRADOR_ID)).toThrow(TransicaoInvalidaError);
  });
});
