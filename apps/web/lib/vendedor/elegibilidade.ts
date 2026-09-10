import type { KycStatus } from "@/lib/supabase/database.types";

export interface PerfilVendedor {
  kycStatus: KycStatus;
  pagarmeRecipientId: string | null;
}

export type MotivoInelegibilidade = "kyc_pendente" | "sem_conta_bancaria";

export type Elegibilidade = { elegivel: true } | { elegivel: false; motivo: MotivoInelegibilidade };

// Vendedor só pode publicar anúncio com KYC aprovado E recebedor criado no
// Pagar.me (docs/ARCHITECTURE.md §5.1/§8) — sem os dois, não há como o split
// de pagamento funcionar quando a proposta for aceita.
export function elegibilidadeParaPublicar(perfil: PerfilVendedor): Elegibilidade {
  if (perfil.kycStatus !== "aprovado") {
    return { elegivel: false, motivo: "kyc_pendente" };
  }
  if (!perfil.pagarmeRecipientId) {
    return { elegivel: false, motivo: "sem_conta_bancaria" };
  }
  return { elegivel: true };
}
