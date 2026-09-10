import { afterEach, describe, expect, it, vi } from "vitest";
import { autenticado, eventoIndicaPago, extrairIdPedido, type PagarmeWebhookPayload } from "./webhook";

function headersComBasicAuth(usuario: string, senha: string): Headers {
  const credenciais = Buffer.from(`${usuario}:${senha}`).toString("base64");
  return new Headers({ authorization: `Basic ${credenciais}` });
}

describe("autenticado", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("aceita quando usuário e senha batem com PAGARME_WEBHOOK_USER/PASSWORD", () => {
    vi.stubEnv("PAGARME_WEBHOOK_USER", "consorciolivre");
    vi.stubEnv("PAGARME_WEBHOOK_PASSWORD", "segredo");

    expect(autenticado(headersComBasicAuth("consorciolivre", "segredo"))).toBe(true);
  });

  it("rejeita credenciais erradas", () => {
    vi.stubEnv("PAGARME_WEBHOOK_USER", "consorciolivre");
    vi.stubEnv("PAGARME_WEBHOOK_PASSWORD", "segredo");

    expect(autenticado(headersComBasicAuth("consorciolivre", "errada"))).toBe(false);
  });

  it("rejeita quando não há header de autenticação", () => {
    vi.stubEnv("PAGARME_WEBHOOK_USER", "consorciolivre");
    vi.stubEnv("PAGARME_WEBHOOK_PASSWORD", "segredo");

    expect(autenticado(new Headers())).toBe(false);
  });

  it("rejeita quando as env vars não estão configuradas", () => {
    expect(autenticado(headersComBasicAuth("qualquer", "coisa"))).toBe(false);
  });
});

describe("extrairIdPedido", () => {
  it("lê data.id quando presente", () => {
    const payload: PagarmeWebhookPayload = { data: { id: "or_123" } };
    expect(extrairIdPedido(payload)).toBe("or_123");
  });

  it("usa data.order.id como alternativa", () => {
    const payload: PagarmeWebhookPayload = { data: { order: { id: "or_456" } } };
    expect(extrairIdPedido(payload)).toBe("or_456");
  });

  it("retorna null quando não há id em nenhum formato conhecido", () => {
    const payload: PagarmeWebhookPayload = { data: {} };
    expect(extrairIdPedido(payload)).toBeNull();
  });
});

describe("eventoIndicaPago", () => {
  it("reconhece pelo type contendo 'paid'", () => {
    expect(eventoIndicaPago({ type: "order.paid", data: {} })).toBe(true);
  });

  it("reconhece pelo status 'paid' dentro de data", () => {
    expect(eventoIndicaPago({ data: { status: "paid" } })).toBe(true);
  });

  it("rejeita eventos que não indicam pagamento confirmado", () => {
    expect(eventoIndicaPago({ type: "order.payment_failed", data: { status: "failed" } })).toBe(false);
  });
});
