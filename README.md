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
