# Projeto: Consórcio Livre

Marketplace P2P de compra e venda de cartas de consórcio (contempladas e não contempladas), entre usuários verificados. Não é um marketplace de produtos físicos — não introduzir catálogo/estoque/frete/carrinho multi-vendedor.

Arquitetura e decisões completas: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack fixa

Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres, Auth, RLS, Storage, Realtime), deploy na Vercel, Pagar.me (split de pagamento/escrow via `recipient_id`). Sem NestJS, sem Redis/BullMQ, sem Meilisearch, sem integração de frete — ver `docs/ARCHITECTURE.md` §5.5 para o porquê.

## Regra de negócio central

1 `Anuncio` (uma cota) → 1 `Proposta` aceita → 1 `Transacao` → N `Pagamento`/`transacao_eventos`. Não existe carrinho com itens de múltiplos vendedores nem `SubOrder`.

## Regras não-negociáveis (ver §5.4 do ARCHITECTURE.md)

- Toda feature nova exige teste automatizado (caminho feliz + 1 erro) antes de ser considerada concluída.
- Todo endpoint/Server Action que move dinheiro ou muda posse de cota é idempotente.
- Toda transição de status de `transacoes`/`pagamentos` grava evento em `transacao_eventos` (nunca só `UPDATE` silencioso).
- `transacao_eventos` é append-only (nunca `UPDATE`/`DELETE`).
- Dado pessoal de KYC nunca em log de aplicação; RLS por tabela é a fronteira de acesso, nunca lógica só no client.

## Backlog ativo

Seguir a ordem da Fase 2 em `docs/ARCHITECTURE.md` §8, uma tarefa por vez/PR. Não introduzir itens de Fase 3 (score de crédito avançado, parcerias diretas com administradoras, recomendação, seguro de transação) antes da Fase 2 estar em produção.
