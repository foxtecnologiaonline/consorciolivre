-- Consórcio Livre — schema inicial
-- Convenções: chaves primárias uuid, timestamps em UTC, enums em texto restrito por CHECK
-- para manter migrações simples de alterar sem depender de ALTER TYPE.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Perfis (espelha auth.users do Supabase Auth)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  tipo_pessoa text not null check (tipo_pessoa in ('pf', 'pj')),
  nome_completo text not null,
  documento text not null unique, -- CPF ou CNPJ (armazenar apenas dígitos)
  telefone text,
  kyc_status text not null default 'pendente'
    check (kyc_status in ('pendente', 'em_analise', 'aprovado', 'reprovado')),
  reputacao_media numeric(3, 2) not null default 0,
  total_transacoes integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

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

create table anuncio_midias (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references anuncios (id) on delete cascade,
  url text not null,
  ordem integer not null default 0
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
-- Índices de apoio às buscas mais comuns
-- ---------------------------------------------------------------------------
create index idx_anuncios_status on anuncios (status);
create index idx_anuncios_vendedor on anuncios (vendedor_id);
create index idx_cotas_administradora on cotas (administradora_id);
create index idx_transacoes_comprador on transacoes (comprador_id);
create index idx_transacoes_vendedor on transacoes (vendedor_id);
create index idx_chat_mensagens_thread on chat_mensagens (thread_id, criado_em);
create index idx_notificacoes_profile_lida on notificacoes (profile_id, lida);

-- ---------------------------------------------------------------------------
-- Row Level Security — habilitada em todas as tabelas com dados de usuário
-- Políticas detalhadas serão adicionadas em migrações específicas por tabela,
-- mas o RLS já entra travado por padrão (nenhum acesso sem policy explícita).
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table kyc_verificacoes enable row level security;
alter table cotas enable row level security;
alter table titularidade_documentos enable row level security;
alter table anuncios enable row level security;
alter table anuncio_midias enable row level security;
alter table propostas enable row level security;
alter table transacoes enable row level security;
alter table transacao_eventos enable row level security;
alter table pagamentos enable row level security;
alter table chat_threads enable row level security;
alter table chat_mensagens enable row level security;
alter table avaliacoes enable row level security;
alter table denuncias enable row level security;
alter table notificacoes enable row level security;

-- Exemplo de policy mínima: dono do perfil lê/edita o próprio registro.
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- Anúncios publicados são públicos para leitura; o restante é restrito ao dono.
create policy "anuncios_select_publicos" on anuncios for select
  using (status = 'publicado' or vendedor_id = auth.uid());
create policy "anuncios_insert_own" on anuncios for insert
  with check (vendedor_id = auth.uid());
create policy "anuncios_update_own" on anuncios for update
  using (vendedor_id = auth.uid());
