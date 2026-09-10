-- Fecha a decisão de gateway (docs/ARCHITECTURE.md §5.1): Pagar.me, split via
-- recipient_id. Vendedor precisa cadastrar conta bancária própria e ter um
-- recebedor criado no Pagar.me antes de poder publicar anúncio.

alter table profiles
  add column pagarme_recipient_id text;

create table contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles (id) on delete cascade,
  banco_codigo text not null, -- código de 3 dígitos do banco (febraban)
  agencia text not null,
  agencia_dv text,
  conta text not null,
  conta_dv text not null,
  tipo_conta text not null check (tipo_conta in ('corrente', 'poupanca')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger trg_touch_contas_bancarias before update on contas_bancarias
  for each row execute function touch_atualizado_em();

alter table contas_bancarias enable row level security;

-- Mesma sensibilidade de titularidade_documentos: só o próprio dono e staff
-- (para suporte em disputa de repasse), nunca outro usuário.
create policy "contas_bancarias_select_own_or_staff" on contas_bancarias for select
  using (profile_id = auth.uid() or is_staff(auth.uid()));
create policy "contas_bancarias_insert_own" on contas_bancarias for insert
  with check (profile_id = auth.uid());
create policy "contas_bancarias_update_own" on contas_bancarias for update
  using (profile_id = auth.uid());

comment on column profiles.pagarme_recipient_id is
  'Id do recebedor no Pagar.me (POST /core/v5/recipients), criado quando o vendedor cadastra a conta bancária. Nunca escrito pelo client — só por Server Action com service_role, após confirmação da chamada ao Pagar.me.';

-- ---------------------------------------------------------------------------
-- Fecha uma lacuna pré-existente: a policy "profiles_update_own" libera UPDATE
-- por linha (auth.uid() = id) mas não restringe coluna — sem a trigger abaixo,
-- o próprio usuário logado conseguiria se auto-aprovar no KYC
-- (kyc_status = 'aprovado'), se promover a role = 'admin', fabricar
-- reputacao_media/total_transacoes, ou (a partir de agora) fabricar um
-- pagarme_recipient_id sem nunca ter cadastrado conta bancária de verdade.
-- Essas colunas só podem mudar via trigger do próprio banco (kyc_status por
-- sync_kyc_status, reputacao_media/total_transacoes pelo trigger de avaliações)
-- ou por Server Action com service_role (role, suspenso, pagarme_recipient_id),
-- que não passa por RLS. `pg_trigger_depth() <= 1` deixa passar exatamente essas
-- cascatas internas (o UPDATE em profiles acontece de dentro de outro trigger,
-- profundidade >= 2) sem abrir brecha para o client tentar a mesma coisa direto
-- (profundidade 1 nesse caso).
-- ---------------------------------------------------------------------------
create function proteger_colunas_sensiveis_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and pg_trigger_depth() <= 1 then
    new.kyc_status := old.kyc_status;
    new.role := old.role;
    new.reputacao_media := old.reputacao_media;
    new.total_transacoes := old.total_transacoes;
    new.suspenso := old.suspenso;
    new.pagarme_recipient_id := old.pagarme_recipient_id;
  end if;
  return new;
end;
$$;

create trigger trg_proteger_colunas_sensiveis_profiles before update on profiles
  for each row execute function proteger_colunas_sensiveis_profiles();
