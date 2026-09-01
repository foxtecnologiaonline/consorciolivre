-- Catálogo inicial das maiores administradoras de consórcio do Brasil.
-- Lista editável por staff depois via /painel/admin; isto só evita começar com o
-- formulário de anúncio sem nenhuma opção no select.

insert into administradoras (nome) values
  ('Embracon'),
  ('Porto Consórcio'),
  ('Rodobens Consórcio'),
  ('Servopa'),
  ('HS Consórcios'),
  ('Randon Consórcio'),
  ('Yamaha Consórcio'),
  ('Honda Consórcio'),
  ('Volkswagen Consórcio'),
  ('CNH Industrial Consórcio'),
  ('Âncora Consórcios'),
  ('Unicred Consórcios')
on conflict (nome) do nothing;
