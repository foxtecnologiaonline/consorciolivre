-- Item 4/5 do backlog (docs/ARCHITECTURE.md §8): cobrança real via PIX no
-- Pagar.me, sem split na cobrança (100% fica com a plataforma — o split real
-- só acontece na liberação de escrow, item 6, ver §5.1).

alter table pagamentos
  add column pix_qr_code text,
  add column pix_qr_code_url text,
  add column expira_em timestamptz;

-- Só um pagamento pendente por transação por vez — evita gerar cobranças
-- duplicadas no Pagar.me em cliques repetidos/requisições concorrentes; a
-- Server Action ainda faz uma checagem otimista antes, mas quem garante de
-- verdade é este índice (invariante de banco, não só de aplicação).
create unique index idx_pagamentos_transacao_pendente on pagamentos (transacao_id)
  where status = 'pendente';
