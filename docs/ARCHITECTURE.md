# Consórcio Livre — Arquitetura do Sistema

Marketplace de compra e venda de cartas de consórcio contempladas e não contempladas, entre usuários verificados (pessoa física e jurídica).

> **v2 — revisão**: adicionado papel `staff/admin` com policies de moderação, máquinas de estado explícitas de anúncio/transação, matriz de RLS ("quem vê o quê"), busca textual via `pg_trgm` (sem dependência externa no MVP), tabela de favoritos, idempotência de webhook de pagamento (`gateway + gateway_referencia` único), sincronização automática de `kyc_status` e `reputacao_media` por trigger, e trava de "uma cota = um anúncio ativo por vez". Detalhes no schema (`supabase/migrations/0001_init.sql`).

> **v3 — revisão (set/2026)**: fecha a decisão de gateway de pagamento/escrow (era "ex.: Pagar.me, Mercado Pago, Asaas ou Stripe Connect" — agora **Pagar.me, decisão única**, split nativo via `recipient_id`) e formaliza como regras de engenharia não-negociáveis práticas que já existiam informalmente no schema (idempotência de webhook, trilha de auditoria, máquina de estado). Ver §5.1 e §5.4. Avaliada e descartada explicitamente a adoção de NestJS/modular monolith, Redis/BullMQ, Meilisearch e integração de frete (Melhor Envio/Frenet): esses itens vêm de um escopo genérico de e-commerce multi-vendedor de produtos físicos e não se aplicam ao Consórcio Livre, que negocia titularidade de cotas — não há catálogo de produtos, estoque ou envio físico. Ver §5.5 para o racional completo dessa decisão.

## 1. Visão geral

O Consórcio Livre conecta quem quer **vender uma cota de consórcio** (contemplada ou não, de imóvel, veículo, moto, serviços etc.) a quem quer **comprar essa cota** por um valor abaixo do saldo devedor, evitando os ágios e a opacidade do mercado informal (grupos de WhatsApp, classificados sem garantia).

Pilares do produto:

1. **Confiança** — todo usuário que publica ou compra passa por verificação de identidade (KYC) e, para o vendedor, verificação de titularidade da cota.
2. **Transparência** — cada anúncio expõe dados objetivos da cota (administradora, grupo, valor do crédito, saldo devedor, parcelas pagas/restantes, taxa de administração, status de contemplação).
3. **Segurança financeira** — o dinheiro do comprador fica retido (escrow) até a transferência da cota ser confirmada pela administradora.
4. **Compliance** — LGPD, prevenção a fraude/lavagem, e aderência às regras de transferência de cada administradora (a plataforma nunca substitui a administradora, apenas intermedia a negociação).

Fora de escopo do MVP: a plataforma não é uma administradora de consórcio (regulada pelo BACEN) — ela é o marketplace que intermedia a negociação entre as partes; a efetivação da transferência de titularidade continua sendo feita junto à administradora responsável pelo grupo.

## 2. Personas e papéis

| Papel | Descrição |
|---|---|
| **Comprador** | Usuário verificado que busca e adquire cotas. |
| **Vendedor** | Usuário verificado (dono da cota) que publica anúncios. |
| **Administrador (staff)** | Modera anúncios, valida documentos de verificação/titularidade, resolve disputas. |
| **Suporte/Compliance** | Acompanha KYC, denúncias, bloqueios, relatórios de prevenção a fraude. |
| **Sistema/Backoffice** | Jobs automáticos: expiração de anúncios, lembretes, reconciliação de pagamentos. |

Um mesmo usuário pode ser comprador e vendedor. No banco isso é modelado com uma única coluna `profiles.role` (`user` / `staff` / `admin`) em vez de tabelas separadas — staff e admin apenas herdam permissões de leitura/moderação mais amplas via RLS (função `is_staff()`), evitando duplicar o cadastro de uma pessoa em duas tabelas.

## 3. Modelo de domínio

### Entidades principais

- **User (perfil)** — dados cadastrais, papel, status de verificação (KYC), reputação (score, nº de transações).
- **KycVerification** — documento (CPF/CNPJ, selfie, comprovante de endereço), status (pendente/aprovado/reprovado), provedor usado.
- **Administradora** — catálogo das administradoras de consórcio existentes no Brasil (Embracon, Porto, Rodobens, Servopa, etc.), usado para padronizar os anúncios.
- **Cota (Consortium Quota)** — dados objetivos e verificáveis da cota: administradora, grupo, número da cota, tipo de bem (imóvel/veículo/moto/serviço), valor do crédito, saldo devedor, valor da parcela, parcelas pagas/totais, status (contemplada/não contemplada), forma de contemplação (sorteio/lance), taxa de administração restante.
- **DocumentoTitularidade** — comprovantes anexados pelo vendedor para provar que a cota é dele (contrato de adesão, extrato da administradora).
- **Anuncio (Listing)** — publicação de uma Cota à venda: preço pedido, descrição, fotos/documentos, status (rascunho/em análise/publicado/pausado/vendido/expirado).
- **Proposta/Lance (Offer)** — negociação de preço entre comprador e vendedor dentro de um anúncio (opcional no MVP: preço fechado "comprar agora").
- **Transacao (Order)** — quando uma proposta é aceita: valor acordado, status do fluxo (aguardando pagamento → pagamento em escrow → em transferência na administradora → concluída/cancelada/disputada), comissão da plataforma.
- **Pagamento** — registro de cobrança/liberação via gateway (PIX/boleto/cartão), ligado a uma Transação.
- **Mensagem/Chat** — comunicação entre comprador e vendedor, escopada a um anúncio/transação, com moderação automática (bloqueio de troca de contato para evitar burlar a comissão).
- **Avaliacao (Review)** — nota e comentário pós-transação, dos dois lados.
- **Denuncia (Report)** — sinalização de anúncio/usuário suspeito.
- **Notificacao** — eventos (proposta recebida, pagamento confirmado, documento aprovado etc.), entregues por e-mail/push/in-app.

### Diagrama (visão lógica simplificada)

```
User 1---1 KycVerification
User 1---N Anuncio (como vendedor)
Anuncio N---1 Cota
Cota N---1 Administradora
Anuncio 1---N DocumentoTitularidade
Anuncio 1---N Proposta
Proposta 1---1 Transacao (quando aceita)
Transacao 1---N Pagamento
Transacao 1---1 Chat (thread de mensagens)
Transacao 1---N Avaliacao (comprador->vendedor, vendedor->comprador)
User 1---N Denuncia (autor)
```

## 4. Fluxos principais

### 4.1 Cadastro e verificação (KYC)
1. Cadastro com e-mail/telefone + senha (ou OAuth).
2. Preenchimento de dados pessoais (CPF/CNPJ) + upload de documento oficial + selfie (liveness).
3. Verificação automática via provedor de KYC (ex.: Idwall, unico|check, CAF) — status `pending` → `approved`/`rejected`.
4. Somente usuários `approved` podem publicar anúncios ou fechar transações. Navegar e favoritar pode ser liberado sem KYC (funil de conversão).

### 4.2 Publicar um anúncio (venda)
1. Vendedor precisa estar `approved` no KYC.
2. Preenche os dados da cota (administradora, grupo, valores) + upload dos documentos de titularidade.
3. Anúncio entra em `em_analise` — validação automática (campos obrigatórios, documento legível via OCR) + eventual revisão manual por amostragem/risco.
4. Aprovado → `publicado`, visível na busca.

### 4.3 Compra
1. Comprador `approved` visualiza anúncio, pode conversar via chat interno ou enviar proposta de valor.
2. Vendedor aceita proposta (ou preço fixo "comprar agora") → cria-se a `Transacao`.
3. Comprador paga via PIX/boleto/cartão — valor fica **retido em escrow** (conta garantidora / split de pagamento).
4. Plataforma emite instruções e acompanha o processo de transferência de titularidade junto à administradora (fora do sistema, mas com checklist e upload de comprovante).
5. Confirmada a transferência (documento da administradora), o escrow libera o valor ao vendedor **menos a comissão da plataforma**.
6. Caso a transferência não se concretize em X dias, fluxo de disputa/estorno.

### 4.4 Disputa
- Qualquer parte pode abrir disputa antes da liberação do escrow.
- Time de suporte analisa evidências (chat, documentos, comprovantes) e decide: liberar ao vendedor, estornar ao comprador, ou dividir.

### 4.5 Reputação
- Após a transação concluída, ambos avaliam um ao outro (nota 1–5 + comentário). Score exibido no perfil.

### 4.6 Máquinas de estado

**Anúncio**
```
rascunho → em_analise → publicado → vendido
                 ↓            ↓
             reprovado     pausado → publicado
                              ↓
                          expirado
```
Regra de integridade: uma mesma `cota` só pode ter **um** anúncio em estado "vivo" (`rascunho`, `em_analise`, `publicado` ou `pausado`) por vez — garantido por índice único parcial, não só por regra de aplicação, para não depender de o backend nunca ter um bug de corrida.

**Transação**
```
aguardando_pagamento → pagamento_em_escrow → em_transferencia → concluida
        ↓                      ↓                    ↓
    cancelada              em_disputa ──────→ reembolsada
```
Toda mudança de status grava uma linha em `transacao_eventos` (quem, quando, de onde) — é a trilha de auditoria exigida para disputas e para compliance.

### 4.7 Quem vê o quê (RLS)

| Tabela | Dono/parte | Outro usuário | Staff/Admin |
|---|---|---|---|
| `profiles` | lê/edita o próprio | — | lê todos |
| `kyc_verificacoes` | lê o próprio | — | lê/edita todos (aprovação) |
| `cotas` | dono lê/edita | lê só se houver anúncio `publicado` dela | lê todas |
| `titularidade_documentos` | dono lê | **nunca** (nem o comprador) | lê todos |
| `anuncios` | dono lê/edita todos os status | lê só `publicado` | lê/edita todos |
| `propostas` / `transacoes` / `pagamentos` | comprador e vendedor da negociação | — | lê todos |
| `chat_mensagens` | as duas partes da conversa | — | lê todas (moderação) |
| `avaliacoes` | qualquer um lê (é reputação pública) | leitura pública | — |
| `notificacoes` | só o destinatário | — | — |

`titularidade_documentos` é a linha mais sensível do sistema: o comprador nunca acessa o contrato original do vendedor diretamente pelo banco — apenas os dados já resumidos e validados na `cota`/`anuncio`. Isso evita vazamento de CPF/dados bancários de terceiros embutidos em extratos de administradora.

## 5. Arquitetura técnica

### 5.1 Stack proposta

- **Frontend web**: Next.js (App Router) + TypeScript + Tailwind CSS, deploy na Vercel.
- **Backend/API**: rotas serverless do próprio Next.js (Route Handlers) para regras de negócio simples; para regras críticas (liberação de escrow, webhooks de pagamento, KYC) usar **Supabase Edge Functions** ou um serviço Node separado, para isolar responsabilidades sensíveis.
- **Banco de dados**: PostgreSQL via **Supabase** (Auth, Row Level Security, Storage para documentos, Realtime para chat/notificações).
- **Autenticação**: Supabase Auth (e-mail/senha + OAuth Google) com MFA opcional.
- **Storage de documentos**: Supabase Storage, buckets privados com URLs assinadas de curta duração (documentos de identidade e titularidade nunca são públicos).
- **Pagamentos/escrow**: **Pagar.me** — decisão única, não mais em aberto. O split é nativo via `recipient_id`: cada vendedor precisa de um `recipient_id` cadastrado no Pagar.me no momento em que sua conta é aprovada (staff aprova KYC → backend cria/valida o recipient antes de liberar publicação de anúncio). O comprador paga o valor cheio da transação; o Pagar.me já calcula o split entre a conta da plataforma (retém como escrow) e o `recipient_id` do vendedor no momento da criação da cobrança, sem o vendedor precisar de conta própria na adquirente. A liberação ao vendedor (`pagamentos.status = 'liberado_vendedor'`) só é disparada depois da etapa de transferência de titularidade confirmada — antes disso o valor fica retido do lado da plataforma dentro do próprio split. Fixar 1 gateway evita retrabalho de reconciliação financeira com múltiplos formatos de webhook.
- **KYC**: provedor terceirizado (Idwall / unico|check / CAF) via API, plataforma só armazena o resultado e um hash/URL do documento, nunca reimplementa biometria.
- **Filas/jobs assíncronos**: Supabase Cron / Edge Functions agendadas (ou um worker leve) para: expirar anúncios, lembrar pagamentos pendentes, reconciliar webhooks de pagamento, enviar notificações.
- **Notificações**: e-mail transacional (Resend/SendGrid) + push web + (fase 2) WhatsApp/SMS.
- **Observabilidade**: logs estruturados, Sentry para erros, dashboard de métricas de negócio (funil de conversão, GMV, ticket médio).

### 5.2 Por que este stack
- Time pequeno/solo consegue entregar rápido com Next.js + Supabase (auth, banco, storage e realtime prontos), sem operar infraestrutura própria.
- Row Level Security do Postgres garante isolamento de dados sensíveis (cada usuário só enxerga seus próprios documentos/transações) diretamente no banco, reduzindo risco de vazamento por bug de aplicação.
- Pagamento com split nativo evita a plataforma "tocar" no dinheiro diretamente (reduz risco regulatório) e resolve o escrow.

### 5.3 Segurança e compliance
- **LGPD**: consentimento explícito de coleta de documentos, política de retenção (dados de KYC reprovado apagados após prazo definido), portal de titular de dados (exportar/excluir conta).
- **RLS no Postgres**: políticas por tabela — usuário só lê/escreve seus próprios registros; anúncios `publicado` são públicos, o resto é restrito.
- **Antifraude**: rate limit em cadastro/propostas, verificação de duplicidade de CPF/cota, bloqueio de troca de contato externo no chat (regex + moderação), lista de administradoras/documentos "conhecidos" para reduzir golpes.
- **Segregação de segredos**: chaves do gateway de pagamento e do provedor de KYC apenas em Edge Functions/servidor, nunca no client.
- **Trilha de auditoria**: toda mudança de status de transação/anúncio grava histórico (quem, quando, de onde) em `transacao_eventos`.
- **Idempotência de pagamento**: webhooks do gateway são gravados com `(gateway, gateway_referencia)` único — reentrega do mesmo evento pelo provedor não duplica a liberação de escrow. A escrita nessa tabela é feita exclusivamente pela Edge Function com `service_role` (o client nunca marca um pagamento como confirmado).
- **Busca**: MVP usa índice `pg_trgm` do próprio Postgres em título/descrição do anúncio — evita depender de um serviço de busca externo (Algolia/Meilisearch) antes de haver volume que justifique o custo; migrar é um passo isolado quando o catálogo crescer.

### 5.4 Regras de engenharia não-negociáveis

- **Regra de ouro**: nenhuma feature nova entra sem teste automatizado cobrindo o caminho feliz + 1 caminho de erro. O repositório ainda não tem test runner configurado — isso é dívida a resolver antes da próxima feature de dinheiro/estoque de cota (ver backlog, §8).
- **Idempotência**: todo endpoint/Server Action que move dinheiro (pagamento, liberação de escrow) ou muda posse de cota (aceitar proposta, criar transação) precisa ser seguro para reexecução. Hoje isso já existe para o webhook de pagamento (`idx_pagamentos_gateway_ref`); ao trocar o escrow manual pela integração real com o Pagar.me, o mesmo padrão (chave de idempotência única por evento) se aplica a qualquer novo endpoint de cobrança/estorno.
- **Toda transição de status gera evento/auditoria**: já implementado para `transacoes` via `transacao_eventos` (trigger `trg_touch_transacoes` + inserts explícitos nas actions). Ao evoluir `pagamentos` para o fluxo automatizado do Pagar.me, cada mudança de `pagamentos.status` também deve gravar uma linha auditável (reaproveitar `transacao_eventos` referenciando o pagamento na observação, ou — se o volume justificar — criar `pagamento_eventos` dedicado) em vez de só fazer `UPDATE` destrutivo.
- **Tabelas financeiras são append-only para auditoria**: `transacao_eventos` nunca sofre `UPDATE`/`DELETE` pela aplicação (só `INSERT`); `pagamentos` pode até atualizar campos de controle (`status`, `confirmado_em`, `liberado_em`), mas a *razão* de cada mudança tem que sobreviver em algum registro append-only — nunca só "o status virou outro" sem rastro de por quê.
- **Nenhum módulo lê tabela de domínio alheio diretamente pelo client** — o padrão já usado (Server Actions/route handlers como fronteira, RLS por tabela) cumpre esse papel sem precisar de schemas Postgres separados por módulo: a fronteira é a Server Action + RLS, não um schema.
- **LGPD**: dado pessoal de KYC (documento, selfie, CPF/CNPJ) nunca aparece em log de aplicação nem é acessível por outro usuário além do dono e do staff (já garantido por RLS em `kyc_verificacoes`/`titularidade_documentos` — manter ao adicionar qualquer feature nova que toque essas tabelas).

### 5.5 O que foi avaliado e descartado (e por quê)

Um documento de escopo genérico de "marketplace multi-vendedor" (referências Amazon/Magalu/Mercado Livre/Shopee) foi revisado item a item contra o domínio real do Consórcio Livre. Decisões:

| Proposta genérica | Decisão | Motivo |
|---|---|---|
| NestJS + Modular Monolith (schema por módulo) | **Não adotar** | O time é pequeno e o Next.js/Supabase atual já entrega auth, RLS e Storage prontos; migrar de framework/infra sem um driver de negócio concreto (escala, time crescendo) é retrabalho puro. A fronteira de módulo já existe via Server Actions + RLS por tabela (§5.4). |
| Redis + BullMQ | **Não adotar agora** | Não há hoje nenhum job assíncrono que Supabase Cron/Edge Functions não resolvam (expirar anúncio, lembrete, reconciliação). Reavaliar só se aparecer um caso real de fila com retry/backoff complexo que Edge Functions não cubram bem. |
| Meilisearch | **Não adotar agora** | `pg_trgm` já é a decisão registrada desde a v2 e ainda não há volume de anúncios que justifique operar um serviço de busca externo. Mantido como passo isolado futuro (já previsto em §5.3). |
| Melhor Envio / Frenet (frete) | **Não se aplica** | Consórcio Livre não movimenta produto físico — a "entrega" é a transferência de titularidade da cota junto à administradora, fora do sistema. Não existe nem existirá tabela `shipments` neste domínio. |
| Modelo `Order` → N `SubOrder` por carrinho multi-vendedor | **Não se aplica** | Aqui cada `Anuncio` é uma cota única de um vendedor; não há carrinho com itens de N vendedores no mesmo checkout — a unidade de negociação já é 1 anúncio → 1 proposta → 1 transação. |
| Pagar.me como gateway único, split via `recipient_id` | **Adotado** | Resolve exatamente a mesma necessidade de escrow/split que o Consórcio Livre já tinha em aberto (§5.1) — aqui a "adaptação" foi apenas fechar uma decisão que já estava listada como opção. |
| Idempotência de endpoint financeiro / evento por transição de status / auditoria append-only / regra de teste obrigatório | **Adotado como prática geral** | São práticas de engenharia agnósticas de domínio e de stack — já parcialmente implementadas no schema atual (§5.4), só faltava declará-las explicitamente como regra do projeto. |

## 6. Modelo de dados (schema inicial)

Ver `supabase/migrations/0001_init.sql` para o DDL completo. Tabelas principais:

`profiles`, `kyc_verificacoes`, `administradoras`, `cotas`, `titularidade_documentos`, `anuncios`, `anuncio_midias`, `favoritos`, `propostas`, `transacoes`, `transacao_eventos`, `pagamentos`, `chat_threads`, `chat_mensagens`, `avaliacoes`, `denuncias`, `notificacoes`.

Regras mantidas pelo próprio banco (não só pela aplicação), via constraint/trigger, por serem invariantes de negócio que não podem depender do backend nunca ter um bug: uma cota não pode ter dois anúncios ativos simultâneos; `kyc_status` e `reputacao_media` em `profiles` são sempre um reflexo automático de `kyc_verificacoes`/`avaliacoes`, nunca escritos diretamente; um evento de pagamento do gateway nunca é processado duas vezes.

## 7. Monetização

- **Comissão sobre transação concluída** (ex.: % do valor de venda, cobrada do vendedor na liberação do escrow).
- Planos futuros: destaque de anúncio (boost), assinatura para grandes vendedores/despachantes, leads qualificados para administradoras parceiras.

## 8. Roadmap

**MVP (fase 1) — concluído**
- Cadastro + KYC básico, publicação de anúncio, busca/filtros, chat, proposta de preço, pagamento com escrow manual (checklist operacional), avaliação pós-venda.

**Fase 2 — backlog de execução (ordem fixa, uma tarefa por vez)**

1. Infra de teste: adicionar Vitest (+ Testing Library se necessário para Server Actions/components), configurar `npm test` no CI, e cobrir com teste (caminho feliz + 1 erro) pelo menos o fluxo de máquina de estado de `transacoes` já existente antes de tocar em pagamento de verdade.
2. Cadastro de `recipient_id` do Pagar.me: no fluxo de aprovação de KYC/staff, criar o recipient do vendedor no Pagar.me e persistir o id em `profiles` (nova coluna). Sem `recipient_id` válido, vendedor não pode ter anúncio publicado.
3. Integração de cobrança real: Server Action de checkout cria a transação de pagamento no Pagar.me com split (plataforma + `recipient_id` do vendedor), grava em `pagamentos` (`gateway = 'pagarme'`, `gateway_referencia` = id da transação no Pagar.me).
4. Webhook do Pagar.me (`POST /api/webhooks/pagarme`, Route Handler com `service_role`): idempotente via `idx_pagamentos_gateway_ref` já existente, atualiza `pagamentos.status` e dispara transição de `transacoes.status` (`aguardando_pagamento` → `pagamento_em_escrow`), com evento em `transacao_eventos`.
5. Liberação de escrow automatizada: quando staff confirma a transferência de titularidade (upload de comprovante já previsto no fluxo), dispara liberação do split ao vendedor no Pagar.me e atualiza `pagamentos.status = 'liberado_vendedor'` + `transacoes.status = 'concluida'`.
6. Fluxo de disputa guiado: hoje `painel/admin/disputas` existe na UI — falta a Server Action de staff decidir (liberar vendedor / estornar comprador / dividir) chamando a API de estorno/liberação parcial do Pagar.me, com evento de auditoria.
7. Notificações: e-mail transacional (proposta recebida, pagamento confirmado, documento aprovado/reprovado, disputa aberta) — hoje só existe a tabela `notificacoes`; falta o disparo real.
8. App mobile (React Native/Expo) reaproveitando a mesma API/Supabase — só depois dos itens 1–7 estarem em produção.

**Fase 3**
- Score de crédito/reputação avançado, parcerias diretas com administradoras (API de transferência), recomendação personalizada de cotas, seguro de transação.

Nenhum item de "fase 3" ou funcionalidade fora deste roadmap (catálogo de produtos, estoque, frete, carrinho multi-vendedor) entra antes da Fase 2 estar em produção.

## 9. Estrutura de repositório

```
consorciolivre/
├── apps/
│   └── web/              # Next.js (frontend + API routes)
├── packages/
│   └── ui/                # componentes compartilhados (futuro)
├── supabase/
│   └── migrations/        # schema do banco (SQL versionado)
├── docs/
│   └── ARCHITECTURE.md    # este documento
└── README.md
```
