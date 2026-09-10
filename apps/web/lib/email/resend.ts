// E-mail transacional — decisão fechada (docs/ARCHITECTURE.md §5.1/§8 item 8):
// Resend. API simples e estável (POST /emails, Bearer token), sem a mesma
// incerteza de contrato que os endpoints do Pagar.me neste ambiente.

export class EmailError extends Error {}

export interface DadosEmail {
  to: string;
  subject: string;
  html: string;
}

export async function enviarEmail(dados: DadosEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const remetente = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !remetente) {
    throw new EmailError("RESEND_API_KEY/RESEND_FROM_EMAIL não configuradas.");
  }

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: remetente,
      to: dados.to,
      subject: dados.subject,
      html: dados.html,
    }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new EmailError(`Falha ao enviar e-mail via Resend (${resposta.status}): ${corpo}`);
  }
}
