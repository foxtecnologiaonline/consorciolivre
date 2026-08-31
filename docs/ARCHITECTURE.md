# Consórcio Livre — Arquitetura do Sistema

Marketplace de compra e venda de cartas de consórcio contempladas e não contempladas, entre usuários verificados (pessoa física e jurídica).

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

Um mesmo usuário pode ser comprador e vendedor.

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

## 5. Arquitetura técnica

### 5.1 Stack proposta

- **Frontend web**: Next.js (App Router) + TypeScript + Tailwind CSS, deploy na Vercel.
- **Backend/API**: rotas serverless do próprio Next.js (Route Handlers) para regras de negócio simples; para regras críticas (liberação de escrow, webhooks de pagamento, KYC) usar **Supabase Edge Functions** ou um serviço Node separado, para isolar responsabilidades sensíveis.
- **Banco de dados**: PostgreSQL via **Supabase** (Auth, Row Level Security, Storage para documentos, Realtime para chat/notificações).
- **Autenticação**: Supabase Auth (e-mail/senha + OAuth Google) com MFA opcional.
- **Storage de documentos**: Supabase Storage, buckets privados com URLs assinadas de curta duração (documentos de identidade e titularidade nunca são públicos).
- **Pagamentos/escrow**: gateway com suporte a marketplace/split de pagamento (ex.: Pagar.me, Mercado Pago, Asaas ou Stripe Connect) — dinheiro entra na conta da plataforma/subconta escrow e é repassado ao vendedor só após confirmação da etapa de transferência.
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
- **Trilha de auditoria**: toda mudança de status de transação/anúncio grava histórico (quem, quando, de onde).

## 6. Modelo de dados (schema inicial)

Ver `supabase/migrations/0001_init.sql` para o DDL completo. Tabelas principais:

`profiles`, `kyc_verifications`, `administradoras`, `cotas`, `titularidade_documentos`, `anuncios`, `anuncio_midias`, `propostas`, `transacoes`, `pagamentos`, `chat_threads`, `chat_mensagens`, `avaliacoes`, `denuncias`, `notificacoes`.

## 7. Monetização

- **Comissão sobre transação concluída** (ex.: % do valor de venda, cobrada do vendedor na liberação do escrow).
- Planos futuros: destaque de anúncio (boost), assinatura para grandes vendedores/despachantes, leads qualificados para administradoras parceiras.

## 8. Roadmap

**MVP (fase 1)**
- Cadastro + KYC básico, publicação de anúncio, busca/filtros, chat, proposta de preço, pagamento com escrow manual (checklist operacional), avaliação pós-venda.

**Fase 2**
- Automação total do escrow (webhooks de gateway), disputas com fluxo guiado, notificações por WhatsApp, app mobile (React Native/Expo reaproveitando a mesma API/Supabase).

**Fase 3**
- Score de crédito/reputação avançado, parcerias diretas com administradoras (API de transferência), recomendação personalizada de cotas, seguro de transação.

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
