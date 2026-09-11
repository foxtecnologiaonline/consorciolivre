-- Resolução de disputa por divisão (docs/ARCHITECTURE.md §4.4/§8): staff
-- define um percentual para o vendedor, o restante é devolvido ao
-- comprador. Precisa de um status terminal próprio — 'concluida' (implica
-- transferência confirmada) e 'reembolsada' (implica estorno total) não
-- descrevem um resultado parcial.

alter table transacoes drop constraint transacoes_status_check;
alter table transacoes add constraint transacoes_status_check
  check (status in (
    'aguardando_pagamento', 'pagamento_em_escrow', 'em_transferencia',
    'concluida', 'cancelada', 'em_disputa', 'reembolsada', 'dividida'
  ));

alter table pagamentos drop constraint pagamentos_status_check;
alter table pagamentos add constraint pagamentos_status_check
  check (status in ('pendente', 'confirmado', 'falhou', 'estornado', 'liberado_vendedor', 'dividido'));
