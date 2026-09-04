# Consórcio Livre

Marketplace de compra e venda de cartas de consórcio entre usuários verificados.

- Arquitetura completa: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Schema do banco: [`supabase/migrations`](supabase/migrations)
- Aplicação web: [`apps/web`](apps/web)

## Stack

Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres, Auth, Storage, Realtime), deploy na Vercel.

## Desenvolvimento

```bash
cd apps/web
npm install
npm run dev
```

Configure as variáveis de ambiente em `apps/web/.env.local` (ver `.env.example`).

## Colocando no ar (checklist)

Duas coisas estão pendentes e só o dono da conta consegue destravar:

1. **Projeto Supabase**: a conta `foxtecnologia.online@gmail.com` está no limite de 2
   projetos grátis. Pause um projeto existente (`mycollect` ou `ZapScript`) no
   [dashboard](https://supabase.com/dashboard), faça upgrade do plano, ou use uma conta
   com e-mail diferente.
2. **Vercel ↔ GitHub**: o app do GitHub da Vercel não tem acesso ao repositório
   `consorciolivre`. Libere em https://github.com/settings/installations (instalação do
   app "Vercel", em "Repository access").

Depois de resolver o item 1, aplicar o schema:

```bash
supabase link --project-ref <ref-do-projeto>
supabase db push               # aplica supabase/migrations/*.sql em ordem
supabase gen types typescript --project-id <ref-do-projeto> \
  > apps/web/lib/supabase/database.types.ts
```

Pegue a URL do projeto e a `anon key` em Project Settings → API e preencha
`apps/web/.env.local` (dev) e as env vars do projeto na Vercel (produção):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Depois de resolver o item 2, criar o projeto na Vercel apontando para
`apps/web` como root directory — a partir daí, todo push nesta branch gera um
deploy automático.
