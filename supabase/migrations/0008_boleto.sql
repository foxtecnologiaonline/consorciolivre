-- Boleto como segundo método de pagamento (docs/ARCHITECTURE.md §8, corte de
-- escopo do item 3 revisto): mesmo modelo do PIX (sem split na cobrança),
-- só troca o método. Cartão continua fora — exigiria tokenização client-side.

alter table pagamentos
  add column boleto_linha_digitavel text,
  add column boleto_url text,
  add column boleto_pdf_url text;
