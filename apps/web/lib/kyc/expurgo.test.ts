import { afterEach, describe, expect, it, vi } from "vitest";
import { autenticadoCron, dataLimiteRetencao } from "./expurgo";

describe("autenticadoCron", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("aceita o Bearer token igual a CRON_SECRET", () => {
    vi.stubEnv("CRON_SECRET", "segredo-do-cron");
    const headers = new Headers({ authorization: "Bearer segredo-do-cron" });
    expect(autenticadoCron(headers)).toBe(true);
  });

  it("rejeita token incorreto", () => {
    vi.stubEnv("CRON_SECRET", "segredo-do-cron");
    const headers = new Headers({ authorization: "Bearer outro-valor" });
    expect(autenticadoCron(headers)).toBe(false);
  });

  it("rejeita quando CRON_SECRET não está configurada", () => {
    const headers = new Headers({ authorization: "Bearer qualquer-coisa" });
    expect(autenticadoCron(headers)).toBe(false);
  });
});

describe("dataLimiteRetencao", () => {
  it("calcula a data limite subtraindo os dias de retenção de 'agora'", () => {
    const agora = new Date("2026-09-11T00:00:00.000Z");
    expect(dataLimiteRetencao(90, agora)).toBe("2026-06-13T00:00:00.000Z");
  });
});
