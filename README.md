# Papelaria Felicio

Ecommerce em Next.js App Router para a Papelaria Felicio, com catalogo, carrinho, checkout, conta do cliente, pedidos, Pix automatico, Mercado Pago, Stripe legado, admin, integracao Tiny/Olist e banco SQLite.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- SQLite com `better-sqlite3`
- PostgreSQL preparado para migracao

## Principais fluxos

- catalogo e detalhe de produto
- carrinho com persistencia local
- checkout com pedido salvo no backend
- pagamento via Pix automatico
- pagamento via Mercado Pago Checkout Pro
- compatibilidade com Stripe nos pedidos legados
- webhook de confirmacao de pagamento
- area do cliente com pedidos, enderecos e wishlist
- painel admin para produtos e pedidos
- importacao e sincronizacao de produtos via Tiny/Olist

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run verify
npm run build
```

## Variaveis de ambiente

Crie um arquivo `.env.local` com as chaves necessarias para o projeto. Em especial:

- `JWT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`
- `ORDER_ACCESS_SECRET`
- `PUSHINPAY_TOKEN`
- `PUSHINPAY_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `OLIST_ID_TOKEN`
- `OLIST_TOKEN`
- `OLIST_PRODUCTS_URL`
- `OLIST_PRODUCT_DETAILS_URL`
- `OLIST_PRODUCT_STOCK_URL`
- `OLIST_USE_STOCK_ENDPOINT`
- `OLIST_SYNC_SECRET`
- `ORDER_CLEANUP_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `STORE_ORDER_ALERT_EMAILS`
- `SITE_URL`

Use o arquivo `.env.example` como base para configurar um novo ambiente.

Para gerar o hash bcrypt do admin, voce pode usar:

```bash
node -e "console.log(require('bcryptjs').hashSync('SUA_SENHA_FORTE', 10))"
```

Use esse valor em `ADMIN_PASSWORD_HASH`.

Em producao, o login do admin usa `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH`.
`ADMIN_KEY` ficou apenas como compatibilidade legada fora de producao e nao deve ser usado como configuracao principal.

## Banco de dados

- arquivo SQLite em `data/papelaria.sqlite`
- schema e ajustes incrementais em `src/lib/migrations.ts`
- bootstrap de banco em `src/lib/db.ts`
- cliente Postgres base em `src/lib/postgres.ts`

## Migracao para Postgres

O projeto agora tem a base inicial para migrar os dados atuais do SQLite para Postgres sem perder:

- produtos importados
- imagens
- usuarios
- enderecos
- pedidos
- wishlist
- categorias
- cursores e bloqueios da Tiny/Olist

Variaveis:

- `POSTGRES_URL`
- `POSTGRES_SSL` (`require` se o provedor exigir)

Script:

```bash
npm run db:migrate:postgres
```

Esse script:

- cria o schema em `scripts/postgres/schema.sql`
- le o SQLite atual
- copia os dados para o Postgres

Observacao: nesta fase o app ainda nao foi trocado por completo para usar Postgres nas rotas. Primeiro preservamos os dados; depois trocamos a camada de acesso.

## Observacoes de release

- `npm run lint` passa
- `npm run typecheck` passa
- `npm run verify` roda lint + typecheck em sequencia
- `npm run build` foi validado localmente
- checklist operacional em `docs/release-checklist.md`
- roteiro de teste manual em `docs/manual-smoke-test.md`
- endpoint simples de healthcheck em `/api/health`

## Tiny / Olist ERP

O projeto esta preparado para usar o Tiny como fonte de verdade de:

- nome
- SKU externo
- preco
- estoque

E manter no site como dados locais:

- imagens
- categoria e subcategoria
- selos de vitrine
- destaque, oferta, colecao e favoritos da semana

Configuracao recomendada no `.env.local`:

```env
OLIST_TOKEN=seu-token-do-tiny
OLIST_PRODUCTS_URL=https://api.tiny.com.br/api2/produtos.pesquisa.php
OLIST_PRODUCT_DETAILS_URL=https://api.tiny.com.br/api2/produto.obter.php
OLIST_PRODUCT_STOCK_URL=https://api.tiny.com.br/api2/produto.obter.estoque.php
OLIST_USE_STOCK_ENDPOINT=0
OLIST_SYNC_SECRET=troque-este-segredo
OLIST_SYNC_BATCH_SIZE=10
OLIST_SYNC_PAGES_PER_RUN=1
OLIST_SYNC_PAUSE_MS=1200
```

No admin de produtos voce pode:

- importar em lote
- autoimportar em intervalos
- importar um SKU especifico
- sincronizar os produtos ja importados

Quando um produto importado e removido manualmente do site, o SKU fica bloqueado para nao reaparecer automaticamente na proxima importacao.

## Sync agendado do Tiny

Ha uma rota preparada para sync automatico:

```text
POST /api/cron/olist/sync
```

Autenticacao:

- enviar o header `x-olist-sync-secret: SEU_SEGREDO`
  ou
- usar `?secret=SEU_SEGREDO`

Exemplo com `curl`:

```bash
curl -X POST "https://www.papelariafelicio.com.br/api/cron/olist/sync" \
  -H "x-olist-sync-secret: SEU_SEGREDO"
```

Sugestao de rotina:

- a cada 5 minutos para reduzir conflito entre loja fisica e site
- a cada 30 minutos se quiser aliviar chamadas no Tiny

A rota guarda cursor interno, entao cada execucao continua de onde a anterior parou.

## GitHub Actions para sync do Tiny

O projeto ja inclui o workflow:

```text
.github/workflows/olist-sync.yml
```

Ele roda:

- a cada 5 minutos
- e tambem manualmente via `workflow_dispatch`

Para funcionar no GitHub, configure estes secrets no repositorio:

- `SITE_URL`
  exemplo: `https://www.papelariafelicio.com.br`
- `OLIST_SYNC_SECRET`
  o mesmo valor usado no ambiente publicado

Se quiser aliviar mais o Tiny depois, voce pode aumentar esse intervalo, mas para itens com estoque baixo o ideal e manter a sincronizacao curta.

## Limpeza automatica de pedidos nao pagos

O projeto agora inclui uma rota para remover pedidos abandonados que ainda ficaram em:

- `aguardando_pagamento`

Por seguranca, a limpeza padrao atinge apenas:

- `card_mercadopago`
- `card_stripe`

Configuracao no `.env.local`:

```env
ORDER_CLEANUP_SECRET=troque-este-segredo
ORDER_CLEANUP_MINUTES=30
ORDER_CLEANUP_METHODS=card_mercadopago,card_stripe
```

Rota:

```text
POST /api/cron/orders/cleanup
```

Autenticacao:

- enviar o header `x-order-cleanup-secret: SEU_SEGREDO`
  ou
- usar `?secret=SEU_SEGREDO`

Exemplo:

```bash
curl -X POST "https://www.papelariafelicio.com.br/api/cron/orders/cleanup" \
  -H "x-order-cleanup-secret: SEU_SEGREDO"
```

O workflow incluido em:

```text
.github/workflows/order-cleanup.yml
```

roda automaticamente:

- a cada 15 minutos
- e tambem pode ser executado manualmente

Secrets necessarios no GitHub:

- `SITE_URL`
- `ORDER_CLEANUP_SECRET`

## Alerta de novo pedido

O projeto pode avisar a loja sempre que um novo pedido for criado.

Configure no `.env.local`:

```env
STORE_ORDER_ALERT_EMAILS=loja@papelariafelicio.com.br
```

Se quiser receber em mais de um endereco, use lista separada por virgula:

```env
STORE_ORDER_ALERT_EMAILS=loja@papelariafelicio.com.br,financeiro@papelariafelicio.com.br
```

O envio reutiliza a mesma estrutura do Resend ja usada pelo projeto.

Hoje o canal operacional principal para novo pedido esta por email.

## Pagamentos

Hoje o checkout principal usa:

- Pix automatico via PushinPay
- cartao com redirecionamento para o Mercado Pago Checkout Pro

O suporte ao Stripe foi mantido apenas para compatibilidade com pedidos antigos e webhooks legados.

## Areas em evolucao

- frete segue mockado
- algumas secoes da conta seguem planejadas para fase posterior
