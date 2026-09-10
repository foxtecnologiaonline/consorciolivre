import { createAdminClient } from "@/lib/supabase/admin";
import { EmailError, enviarEmail } from "@/lib/email/resend";

export type TipoNotificacao =
  | "proposta_recebida"
  | "pagamento_confirmado"
  | "documento_aprovado"
  | "documento_reprovado"
  | "disputa_aberta";

export interface DadosNotificacao {
  profileId: string;
  tipo: TipoNotificacao;
  titulo: string;
  corpo: string;
}

// notificacoes só tem policy de SELECT/UPDATE pro próprio dono (nunca
// INSERT) — quem dispara uma notificação quase sempre é outra pessoa (o
// comprador avisando o vendedor, staff avisando o usuário do KYC...), que
// nem deveria conseguir escrever na caixa de notificação alheia direto.
// Por isso sempre via service_role.
//
// Grava a notificação in-app primeiro (sempre) e só depois tenta o e-mail —
// e-mail é best-effort: uma falha no Resend não deve derrubar o fluxo
// principal que chamou isso (aceitar proposta, confirmar pagamento etc.), a
// notificação in-app já ficou registrada de qualquer forma.
export async function notificar(dados: DadosNotificacao): Promise<void> {
  const admin = createAdminClient();

  await admin.from("notificacoes").insert({
    profile_id: dados.profileId,
    tipo: dados.tipo,
    titulo: dados.titulo,
    corpo: dados.corpo,
  });

  const { data } = await admin.auth.admin.getUserById(dados.profileId);
  const email = data?.user?.email;
  if (!email) return;

  try {
    await enviarEmail({
      to: email,
      subject: dados.titulo,
      html: `<p>${dados.corpo}</p>`,
    });
  } catch (erro) {
    if (!(erro instanceof EmailError)) throw erro;
  }
}
