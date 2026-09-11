import { describe, expect, it } from "vitest";
import {
  montarPayloadCriacaoRecebedor,
  montarPayloadPedidoBoleto,
  montarPayloadPedidoPix,
  montarPayloadTransferencia,
  type DadosBancarios,
  type DadosPedidoBoleto,
  type DadosPedidoPix,
  type DadosRecebedor,
  type DadosTransferencia,
} from "./client";

const recebedorPf: DadosRecebedor = {
  nome: "Maria Silva",
  email: "maria@example.com",
  documento: "12345678900",
  tipoPessoa: "individual",
};

const banco: DadosBancarios = {
  bancoCodigo: "341",
  agencia: "1234",
  conta: "56789",
  contaDv: "0",
  tipoConta: "checking",
};

describe("montarPayloadCriacaoRecebedor", () => {
  it("monta o payload de pessoa física com name e sem company_name", () => {
    const payload = montarPayloadCriacaoRecebedor(recebedorPf, banco);

    expect(payload.register_information).toEqual({
      type: "individual",
      document: "12345678900",
      email: "maria@example.com",
      name: "Maria Silva",
    });
    expect(payload.default_bank_account).toEqual({
      holder_name: "Maria Silva",
      holder_type: "individual",
      holder_document: "12345678900",
      bank: "341",
      branch_number: "1234",
      branch_check_digit: "",
      account_number: "56789",
      account_check_digit: "0",
      type: "checking",
    });
    expect(payload.code).toBe("12345678900");
  });

  it("monta o payload de pessoa jurídica com company_name e sem name", () => {
    const recebedorPj: DadosRecebedor = {
      nome: "Consorcio Livre LTDA",
      email: "financeiro@example.com",
      documento: "12345678000199",
      tipoPessoa: "company",
    };

    const payload = montarPayloadCriacaoRecebedor(recebedorPj, banco);

    expect(payload.register_information).toEqual({
      type: "company",
      document: "12345678000199",
      email: "financeiro@example.com",
      company_name: "Consorcio Livre LTDA",
    });
    expect(payload.register_information).not.toHaveProperty("name");
  });
});

describe("montarPayloadPedidoPix", () => {
  const dadosPedido: DadosPedidoPix = {
    valorCentavos: 150000,
    descricao: "Cota Embracon grupo 123",
    referenciaExterna: "transacao-abc-123",
    cliente: {
      nome: "João Comprador",
      email: "joao@example.com",
      documento: "98765432100",
      tipoPessoa: "individual",
    },
  };

  it("monta o pedido com um item, cliente e método pix com expiração padrão de 1h", () => {
    const payload = montarPayloadPedidoPix(dadosPedido);

    expect(payload.items).toEqual([
      { amount: 150000, description: "Cota Embracon grupo 123", quantity: 1, code: "transacao-abc-123" },
    ]);
    expect(payload.customer).toEqual({
      name: "João Comprador",
      email: "joao@example.com",
      type: "individual",
      document: "98765432100",
      document_type: "CPF",
    });
    expect(payload.payments).toEqual([{ payment_method: "pix", pix: { expires_in: 3600 } }]);
  });

  it("usa document_type CNPJ e expiração customizada para pessoa jurídica", () => {
    const payload = montarPayloadPedidoPix({
      ...dadosPedido,
      expiraEmSegundos: 900,
      cliente: { ...dadosPedido.cliente, tipoPessoa: "company", documento: "12345678000199" },
    });

    expect(payload.customer.document_type).toBe("CNPJ");
    expect(payload.payments[0].pix.expires_in).toBe(900);
  });
});

describe("montarPayloadTransferencia", () => {
  it("monta o payload de transferência com valor, recipient_id e metadata de conciliação", () => {
    const dados: DadosTransferencia = {
      recipientId: "rp_123",
      valorCentavos: 142500,
      referenciaExterna: "transacao-abc-123",
    };

    expect(montarPayloadTransferencia(dados)).toEqual({
      amount: 142500,
      recipient_id: "rp_123",
      metadata: { transacao_id: "transacao-abc-123" },
    });
  });
});

describe("montarPayloadPedidoBoleto", () => {
  const dadosBoleto: DadosPedidoBoleto = {
    valorCentavos: 150000,
    descricao: "Cota Embracon grupo 123",
    referenciaExterna: "transacao-abc-123",
    vencimentoEm: "2026-09-15T00:00:00Z",
    cliente: {
      nome: "João Comprador",
      email: "joao@example.com",
      documento: "98765432100",
      tipoPessoa: "individual",
    },
  };

  it("monta o pedido com item, cliente e método boleto com vencimento e document_number", () => {
    const payload = montarPayloadPedidoBoleto(dadosBoleto);

    expect(payload.items).toEqual([
      { amount: 150000, description: "Cota Embracon grupo 123", quantity: 1, code: "transacao-abc-123" },
    ]);
    expect(payload.payments).toEqual([
      {
        payment_method: "boleto",
        boleto: {
          due_at: "2026-09-15T00:00:00Z",
          instructions: undefined,
          document_number: "transacao-abc-123",
        },
      },
    ]);
  });

  it("reaproveita o mesmo customer do pedido PIX (mesma base compartilhada)", () => {
    const pix = montarPayloadPedidoPix(dadosBoleto);
    const boleto = montarPayloadPedidoBoleto(dadosBoleto);
    expect(boleto.customer).toEqual(pix.customer);
  });
});
