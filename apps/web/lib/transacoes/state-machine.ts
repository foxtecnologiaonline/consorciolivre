export type TransacaoStatus =
  | "aguardando_pagamento"
  | "pagamento_em_escrow"
  | "em_transferencia"
  | "concluida"
  | "cancelada"
  | "em_disputa"
  | "reembolsada";

export interface Transacao {
  status: TransacaoStatus;
  compradorId: string;
  vendedorId: string;
}

export class TransicaoInvalidaError extends Error {}

interface Transicao {
  statusAnterior: TransacaoStatus;
  statusNovo: TransacaoStatus;
}

function exigirParte(transacao: Transacao, atorId: string) {
  if (atorId !== transacao.compradorId && atorId !== transacao.vendedorId) {
    throw new TransicaoInvalidaError("Ação não permitida.");
  }
}

// Confirmação vem do webhook do gateway (pagamento real via PIX), não de um
// ator humano — por isso não recebe/valida atorId como as demais transições.
export function confirmarPagamentoGateway(transacao: Transacao): Transicao {
  if (transacao.status !== "aguardando_pagamento") {
    throw new TransicaoInvalidaError("Transação não está aguardando pagamento.");
  }
  return { statusAnterior: "aguardando_pagamento", statusNovo: "pagamento_em_escrow" };
}

// Vendedor confirma que recebeu o valor e vai iniciar a transferência na administradora.
export function confirmarRecebimento(transacao: Transacao, atorId: string): Transicao {
  if (atorId !== transacao.vendedorId || transacao.status !== "pagamento_em_escrow") {
    throw new TransicaoInvalidaError("Ação não permitida neste momento.");
  }
  return { statusAnterior: "pagamento_em_escrow", statusNovo: "em_transferencia" };
}

// Comprador confirma que a administradora já efetivou a transferência da cota.
export function confirmarTransferencia(transacao: Transacao, atorId: string): Transicao {
  if (atorId !== transacao.compradorId || transacao.status !== "em_transferencia") {
    throw new TransicaoInvalidaError("Ação não permitida neste momento.");
  }
  return { statusAnterior: "em_transferencia", statusNovo: "concluida" };
}

const STATUS_ELEGIVEIS_PARA_DISPUTA: TransacaoStatus[] = ["pagamento_em_escrow", "em_transferencia"];

export function abrirDisputa(transacao: Transacao, atorId: string): Transicao {
  exigirParte(transacao, atorId);
  if (!STATUS_ELEGIVEIS_PARA_DISPUTA.includes(transacao.status)) {
    throw new TransicaoInvalidaError("Só é possível abrir disputa após o pagamento.");
  }
  return { statusAnterior: transacao.status, statusNovo: "em_disputa" };
}

// Cancelamento só antes de qualquer pagamento confirmado — depois disso, só staff
// resolve (via disputa).
export function cancelarTransacao(transacao: Transacao, atorId: string): Transicao {
  exigirParte(transacao, atorId);
  if (transacao.status !== "aguardando_pagamento") {
    throw new TransicaoInvalidaError("Ação não permitida neste momento.");
  }
  return { statusAnterior: "aguardando_pagamento", statusNovo: "cancelada" };
}
