-- Item 7 do backlog (docs/ARCHITECTURE.md §8): resolução de disputa passa a
-- mexer de verdade no Pagar.me (liberar ao vendedor ou estornar ao
-- comprador). Estorno precisa do id da charge (não só do pedido) para
-- cancelar via POST /core/v5/charges/{id}/cancel.

alter table pagamentos
  add column gateway_charge_id text;
