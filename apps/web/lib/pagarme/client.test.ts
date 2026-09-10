import { describe, expect, it } from "vitest";
import { montarPayloadCriacaoRecebedor, type DadosBancarios, type DadosRecebedor } from "./client";

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
