-- Consórcio Livre — schema inicial
-- Convenções: chaves primárias uuid, timestamps em UTC, enums em texto restrito por CHECK
-- para manter migrações simples de alterar sem depender de ALTER TYPE.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm"; -- busca textual (título/descrição) sem serviço externo no MVP

-- ---------------------------------------------------------------------------
-- Perfis (espelha auth.users do Supabase Auth)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'staff', 'admin')),
  tipo_pessoa text not null check (tipo_pessoa in ('pf', 'pj')),
  nome_completo text not null,
  documento text not null unique, -- CPF ou CNPJ (armazenar apenas dígitos)
  telefone text,
  kyc_status text not null default 'pendente'
    check (kyc_status in ('pendente', 'em_analise', 'aprovado', 'reprovado')),
  reputacao_media numeric(3, 2) not null default 0,
  total_transacoes integer not null default 0,
  suspenso boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Helper para policies: evita repetir subquery `exists(select 1 from profiles where ...)`
-- em toda política de staff/admin. security definer + search_path fixo para não ser
-- sequestrada por um `profiles` de outro schema.
create function is_staff(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role in ('staff', 'admin') from profiles where id = uid), false);
$$;

create table kyc_verificacoes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  provedor text not null, -- ex: 'idwall', 'unico', 'caf'
  provedor_referencia text, -- id da checagem no provedor
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'reprovado')),
  motivo_reprovacao text,
  documento_frente_url text,
  documento_verso_url text,
  selfie_url text,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

-- Mantém profiles.kyc_status (campo denormalizado para leitura rápida em RLS/UI)
-- sincronizado com o resultado mais recente em kyc_verificacoes.
create function sync_kyc_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles set kyc_status = new.status, atualizado_em = now()
  where id = new.profile_id;
  return new;
end;
$$;

create trigger trg_sync_kyc_status
  after insert or update of status on kyc_verificacoes
  for each row execute function sync_kyc_status();

-- ---------------------------------------------------------------------------
-- Catálogo de administradoras de consórcio
-- ---------------------------------------------------------------------------
create table administradoras (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cnpj text unique,
  ativo boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Cota de consórcio (dado objetivo do bem/contrato)
-- ---------------------------------------------------------------------------
create table cotas (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references profiles (id) on delete cascade,
  administradora_id uuid not null references administradoras (id),
  tipo_bem text not null check (tipo_bem in ('imovel', 'veiculo', 'moto', 'servico', 'pesados')),
  numero_grupo text not null,
  numero_cota text not null,
  valor_credito numeric(14, 2) not null,
  saldo_devedor numeric(14, 2) not null,
  valor_parcela numeric(14, 2) not null,
  parcelas_pagas integer not null default 0,
  parcelas_totais integer not null,
  taxa_administracao_restante numeric(6, 3),
  contemplada boolean not null default false,
  forma_contemplacao text check (forma_contemplacao in ('sorteio', 'lance', null)),
  criado_em timestamptz not null default now(),
  unique (administradora_id, numero_grupo, numero_cota)
);

create table titularidade_documentos (
  id uuid primary key default gen_random_uuid(),
  cota_id uuid not null references cotas (id) on delete cascade,
  tipo text not null check (tipo in ('contrato_adesao', 'extrato_administradora', 'termo_contemplacao', 'outro')),
  arquivo_url text not null,
  validado boolean not null default false,
  validado_por uuid references profiles (id),
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Anúncios
-- ---------------------------------------------------------------------------
create table anuncios (
  id uuid primary key default gen_random_uuid(),
  cota_id uuid not null references cotas (id) on delete cascade,
  vendedor_id uuid not null references profiles (id) on delete cascade,
  titulo text not null,
  descricao text,
  preco numeric(14, 2) not null,
  aceita_proposta boolean not null default true,
  status text not null default 'em_analise'
    check (status in ('rascunho', 'em_analise', 'publicado', 'pausado', 'vendido', 'reprovado', 'expirado')),
  motivo_reprovacao text,
  publicado_em timestamptz,
  expira_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Uma cota só pode ter um anúncio "vivo" por vez (evita vender a mesma cota duas vezes).
create unique index idx_anuncios_cota_ativo on anuncios (cota_id)
  where status in ('rascunho', 'em_analise', 'publicado', 'pausado');

create table anuncio_midias (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references anuncios (id) on delete cascade,
  url text not null,
  ordem integer not null default 0
);

create table favoritos (
  profile_id uuid not null references profiles (id) on delete cascade,
  anuncio_id uuid not null references anuncios (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (profile_id, anuncio_id)
);

-- ---------------------------------------------------------------------------
-- Negociação e transação
-- ---------------------------------------------------------------------------
create table propostas (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references anuncios (id) on delete cascade,
  comprador_id uuid not null references profiles (id) on delete cascade,
  valor numeric(14, 2) not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'aceita', 'recusada', 'expirada', 'cancelada')),
  criado_em timestamptz not null default now(),
  respondido_em timestamptz
);

create table transacoes (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references anuncios (id),
  proposta_id uuid references propostas (id),
  comprador_id uuid not null references profiles (id),
  vendedor_id uuid not null references profiles (id),
  valor_acordado numeric(14, 2) not null,
  comissao_percentual numeric(5, 2) not null default 5.00,
  comissao_valor numeric(14, 2) generated always as (valor_acordado * comissao_percentual / 100) stored,
  status text not null default 'aguardando_pagamento'
    check (status in (
      'aguardando_pagamento', 'pagamento_em_escrow', 'em_transferencia',
      'concluida', 'cancelada', 'em_disputa', 'reembolsada'
    )),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table transacao_eventos (
  id uuid primary key default gen_random_uuid(),
  transacao_id uuid not null references transacoes (id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  ator_id uuid references profiles (id),
  observacao text,
  criado_em timestamptz not null default now()
);

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  transacao_id uuid not null references transacoes (id) on delete cascade,
  gateway text not null, -- 'pagarme', 'mercadopago', 'stripe', etc.
  gateway_referencia text,
  metodo text check (metodo in ('pix', 'boleto', 'cartao')),
  valor numeric(14, 2) not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'confirmado', 'falhou', 'estornado', 'liberado_vendedor')),
  criado_em timestamptz not null default now(),
  confirmado_em timestamptz,
  liberado_em timestamptz
);

-- Evita processar o mesmo webhook do gateway duas vezes (retry/duplicata de evento).
create unique index idx_pagamentos_gateway_ref on pagamentos (gateway, gateway_referencia)
  where gateway_referencia is not null;

-- ---------------------------------------------------------------------------
-- Comunicação
-- ---------------------------------------------------------------------------
create table chat_threads (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references anuncios (id) on delete cascade,
  comprador_id uuid not null references profiles (id) on delete cascade,
  vendedor_id uuid not null references profiles (id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (anuncio_id, comprador_id)
);

create table chat_mensagens (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads (id) on delete cascade,
  autor_id uuid not null references profiles (id),
  conteudo text not null,
  sinalizada boolean not null default false, -- ex: tentativa de troca de contato externo
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reputação e moderação
-- ---------------------------------------------------------------------------
create table avaliacoes (
  id uuid primary key default gen_random_uuid(),
  transacao_id uuid not null references transacoes (id) on delete cascade,
  autor_id uuid not null references profiles (id),
  alvo_id uuid not null references profiles (id),
  nota integer not null check (nota between 1 and 5),
  comentario text,
  criado_em timestamptz not null default now(),
  unique (transacao_id, autor_id)
);

-- Recalcula profiles.reputacao_media e total_transacoes a cada avaliação nova.
create function refresh_reputacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles set
    reputacao_media = (select round(avg(nota), 2) from avaliacoes where alvo_id = new.alvo_id),
    total_transacoes = (select count(distinct transacao_id) from avaliacoes where alvo_id = new.alvo_id)
  where id = new.alvo_id;
  return new;
end;
$$;

create trigger trg_refresh_reputacao
  after insert on avaliacoes
  for each row execute function refresh_reputacao();

create table denuncias (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references profiles (id),
  anuncio_id uuid references anuncios (id) on delete cascade,
  usuario_denunciado_id uuid references profiles (id),
  motivo text not null,
  status text not null default 'aberta' check (status in ('aberta', 'em_analise', 'resolvida', 'descartada')),
  criado_em timestamptz not null default now()
);

create table notificacoes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  tipo text not null,
  titulo text not null,
  corpo text,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- atualizado_em automático nas tabelas que o possuem
-- ---------------------------------------------------------------------------
create function touch_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger trg_touch_profiles before update on profiles
  for each row execute function touch_atualizado_em();
create trigger trg_touch_anuncios before update on anuncios
  for each row execute function touch_atualizado_em();
create trigger trg_touch_transacoes before update on transacoes
  for each row execute function touch_atualizado_em();

-- ---------------------------------------------------------------------------
-- Índices de apoio às buscas mais comuns
-- ---------------------------------------------------------------------------
create index idx_anuncios_status on anuncios (status);
create index idx_anuncios_vendedor on anuncios (vendedor_id);
create index idx_anuncios_busca_texto on anuncios using gin (titulo gin_trgm_ops, descricao gin_trgm_ops);
create index idx_cotas_administradora on cotas (administradora_id);
create index idx_cotas_vendedor on cotas (vendedor_id);
create index idx_propostas_anuncio on propostas (anuncio_id);
create index idx_transacoes_comprador on transacoes (comprador_id);
create index idx_transacoes_vendedor on transacoes (vendedor_id);
create index idx_chat_mensagens_thread on chat_mensagens (thread_id, criado_em);
create index idx_notificacoes_profile_lida on notificacoes (profile_id, lida);
create index idx_avaliacoes_alvo on avaliacoes (alvo_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — RLS habilitada e com policy completa em todas as
-- tabelas com dados de usuário. Regra geral: dono do registro (ou uma das
-- partes de uma transação/chat) lê e escreve o que é seu; staff/admin (via
-- is_staff) tem select amplo para moderação; nada é liberado por omissão.
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table kyc_verificacoes enable row level security;
alter table cotas enable row level security;
alter table titularidade_documentos enable row level security;
alter table anuncios enable row level security;
alter table anuncio_midias enable row level security;
alter table favoritos enable row level security;
alter table propostas enable row level security;
alter table transacoes enable row level security;
alter table transacao_eventos enable row level security;
alter table pagamentos enable row level security;
alter table chat_threads enable row level security;
alter table chat_mensagens enable row level security;
alter table avaliacoes enable row level security;
alter table denuncias enable row level security;
alter table notificacoes enable row level security;

-- profiles: cada um lê/edita o próprio registro; staff enxerga todos (moderação/KYC).
create policy "profiles_select_own_or_staff" on profiles for select
  using (auth.uid() = id or is_staff(auth.uid()));
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- kyc_verificacoes: só o dono e staff (aprovação) enxergam.
create policy "kyc_select_own_or_staff" on kyc_verificacoes for select
  using (profile_id = auth.uid() or is_staff(auth.uid()));
create policy "kyc_insert_own" on kyc_verificacoes for insert
  with check (profile_id = auth.uid());
create policy "kyc_update_staff" on kyc_verificacoes for update
  using (is_staff(auth.uid()));

-- cotas: visível para o dono, staff, e para quem enxerga o anúncio publicado dela.
create policy "cotas_select_own_staff_or_anunciada" on cotas for select
  using (
    vendedor_id = auth.uid() or is_staff(auth.uid())
    or exists (select 1 from anuncios a where a.cota_id = cotas.id and a.status = 'publicado')
  );
create policy "cotas_insert_own" on cotas for insert with check (vendedor_id = auth.uid());
create policy "cotas_update_own" on cotas for update using (vendedor_id = auth.uid());

-- titularidade_documentos: nunca público — só o dono da cota e staff (nem comprador vê).
create policy "titularidade_select_own_or_staff" on titularidade_documentos for select
  using (
    is_staff(auth.uid())
    or exists (select 1 from cotas c where c.id = titularidade_documentos.cota_id and c.vendedor_id = auth.uid())
  );
create policy "titularidade_insert_own" on titularidade_documentos for insert
  with check (exists (select 1 from cotas c where c.id = cota_id and c.vendedor_id = auth.uid()));

-- anuncios: publicados são públicos; rascunho/em_analise só dono e staff.
create policy "anuncios_select_publicos_own_or_staff" on anuncios for select
  using (status = 'publicado' or vendedor_id = auth.uid() or is_staff(auth.uid()));
create policy "anuncios_insert_own" on anuncios for insert with check (vendedor_id = auth.uid());
create policy "anuncios_update_own_or_staff" on anuncios for update
  using (vendedor_id = auth.uid() or is_staff(auth.uid()));

create policy "anuncio_midias_select_via_anuncio" on anuncio_midias for select
  using (exists (
    select 1 from anuncios a where a.id = anuncio_midias.anuncio_id
    and (a.status = 'publicado' or a.vendedor_id = auth.uid() or is_staff(auth.uid()))
  ));
create policy "anuncio_midias_insert_own" on anuncio_midias for insert
  with check (exists (select 1 from anuncios a where a.id = anuncio_id and a.vendedor_id = auth.uid()));

-- favoritos: só o próprio usuário.
create policy "favoritos_all_own" on favoritos for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- propostas: comprador que fez, vendedor do anúncio, ou staff.
create policy "propostas_select_partes_ou_staff" on propostas for select
  using (
    comprador_id = auth.uid() or is_staff(auth.uid())
    or exists (select 1 from anuncios a where a.id = propostas.anuncio_id and a.vendedor_id = auth.uid())
  );
create policy "propostas_insert_comprador" on propostas for insert with check (comprador_id = auth.uid());
create policy "propostas_update_partes" on propostas for update
  using (
    comprador_id = auth.uid()
    or exists (select 1 from anuncios a where a.id = propostas.anuncio_id and a.vendedor_id = auth.uid())
  );

-- transacoes / eventos / pagamentos: só comprador, vendedor e staff. Escrita real
-- de pagamento acontece via service_role (webhook do gateway), não pelo client.
create policy "transacoes_select_partes_ou_staff" on transacoes for select
  using (comprador_id = auth.uid() or vendedor_id = auth.uid() or is_staff(auth.uid()));
create policy "transacao_eventos_select_partes_ou_staff" on transacao_eventos for select
  using (is_staff(auth.uid()) or exists (
    select 1 from transacoes t where t.id = transacao_eventos.transacao_id
    and (t.comprador_id = auth.uid() or t.vendedor_id = auth.uid())
  ));
create policy "pagamentos_select_partes_ou_staff" on pagamentos for select
  using (is_staff(auth.uid()) or exists (
    select 1 from transacoes t where t.id = pagamentos.transacao_id
    and (t.comprador_id = auth.uid() or t.vendedor_id = auth.uid())
  ));

-- chat: só as duas partes da conversa e staff (moderação de denúncia).
create policy "chat_threads_select_partes_ou_staff" on chat_threads for select
  using (comprador_id = auth.uid() or vendedor_id = auth.uid() or is_staff(auth.uid()));
create policy "chat_threads_insert_comprador" on chat_threads for insert
  with check (comprador_id = auth.uid());
create policy "chat_mensagens_select_partes_ou_staff" on chat_mensagens for select
  using (is_staff(auth.uid()) or exists (
    select 1 from chat_threads th where th.id = chat_mensagens.thread_id
    and (th.comprador_id = auth.uid() or th.vendedor_id = auth.uid())
  ));
create policy "chat_mensagens_insert_partes" on chat_mensagens for insert
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from chat_threads th where th.id = thread_id
      and (th.comprador_id = auth.uid() or th.vendedor_id = auth.uid())
    )
  );

-- avaliacoes: leitura pública (é reputação), escrita só pelo autor.
create policy "avaliacoes_select_public" on avaliacoes for select using (true);
create policy "avaliacoes_insert_autor" on avaliacoes for insert with check (autor_id = auth.uid());

-- denuncias: autor e staff.
create policy "denuncias_select_autor_ou_staff" on denuncias for select
  using (autor_id = auth.uid() or is_staff(auth.uid()));
create policy "denuncias_insert_autor" on denuncias for insert with check (autor_id = auth.uid());
create policy "denuncias_update_staff" on denuncias for update using (is_staff(auth.uid()));

-- notificacoes: só o destinatário.
create policy "notificacoes_select_own" on notificacoes for select using (profile_id = auth.uid());
create policy "notificacoes_update_own" on notificacoes for update using (profile_id = auth.uid());
