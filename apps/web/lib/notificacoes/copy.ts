// Conteúdo das notificações extraído da Server Action pra ficar testável sem
// precisar de um Supabase/Resend de verdade (só isso tem alguma ramificação
// que vale testar isoladamente — os outros disparos de notificar() no
// projeto são textos fixos).
export function notificacaoRevisaoKyc(decisao: "aprovado" | "reprovado", motivoReprovacao: string | null) {
  if (decisao === "aprovado") {
    return {
      tipo: "documento_aprovado" as const,
      titulo: "Verificação aprovada",
      corpo: "Sua identidade foi verificada. Você já pode publicar anúncios.",
    };
  }
  return {
    tipo: "documento_reprovado" as const,
    titulo: "Verificação reprovada",
    corpo: `Sua verificação foi reprovada. ${motivoReprovacao ?? "Envie os documentos novamente."}`,
  };
}
