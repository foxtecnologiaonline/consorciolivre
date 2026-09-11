export type MotivoBloqueioExclusao = "transacao_em_andamento" | "anuncio_ativo";

export interface ContaParaExclusao {
  transacoesEmAndamento: number;
  anunciosAtivos: number;
}

export type ElegibilidadeExclusao = { elegivel: true } | { elegivel: false; motivo: MotivoBloqueioExclusao };

// LGPD (docs/ARCHITECTURE.md §5.3): direito à eliminação existe, mas não pode
// quebrar a trilha de auditoria de uma negociação em andamento nem deixar um
// anúncio publicado sem dono — por isso a conta só é elegível para exclusão
// sem nenhuma transação ou anúncio em estado não-terminal.
export function elegibilidadeParaExclusao(conta: ContaParaExclusao): ElegibilidadeExclusao {
  if (conta.transacoesEmAndamento > 0) {
    return { elegivel: false, motivo: "transacao_em_andamento" };
  }
  if (conta.anunciosAtivos > 0) {
    return { elegivel: false, motivo: "anuncio_ativo" };
  }
  return { elegivel: true };
}
