# Release Checklist

## Status atual

- [x] fluxo principal de ecommerce funcionando
- [x] checkout criando pedido no backend
- [x] Pix automatico integrado ao fluxo principal
- [x] webhook de pagamento ativo
- [x] checkout com cartao configurado
- [x] area do cliente com pedidos, enderecos e wishlist
- [x] painel admin com protecao basica de sessao
- [x] Tiny/Olist importando produtos no admin
- [x] rota de debug do banco removida
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run verify`
- [x] `npm run build` validado em ambiente local sem restricao de IPC/fork

## Checklist antes de publicar

### Infra e ambiente

- [ ] validar `/api/health` no ambiente publicado
- [ ] validar `SITE_URL` do ambiente final
- [ ] revisar `.env.local` ou secrets de producao usando `.env.example`
- [ ] confirmar `JWT_SECRET`
- [ ] confirmar `ADMIN_USERNAME`
- [ ] confirmar `ADMIN_PASSWORD_HASH`
- [ ] confirmar `ADMIN_SESSION_SECRET`
- [ ] confirmar `ORDER_ACCESS_SECRET`
- [ ] confirmar `PUSHINPAY_WEBHOOK_SECRET`
- [ ] confirmar `MERCADOPAGO_ACCESS_TOKEN`
- [ ] confirmar `MERCADOPAGO_WEBHOOK_SECRET`
- [ ] confirmar credenciais do PushinPay
- [ ] confirmar credenciais do Mercado Pago
- [ ] confirmar credenciais do Resend
- [ ] confirmar `STORE_ORDER_ALERT_EMAILS`
- [ ] confirmar `OLIST_TOKEN`
- [ ] confirmar `OLIST_SYNC_SECRET`
- [ ] validar cron da VPS para sync do Tiny/Olist

### Ecommerce

- [ ] testar jornada completa:
  - produto
  - carrinho
  - checkout
  - pedido
  - Pix
  - sucesso
  - meus pedidos
- [ ] testar pedido com usuario logado
- [ ] testar pedido guest
- [ ] testar webhook marcando pedido como pago
- [ ] testar retorno do Mercado Pago apos cartao aprovado
- [ ] testar estoque apos pagamento confirmado
- [ ] testar Tiny/Olist atualizando estoque no site
- [ ] testar frete mock com CEP valido e invalido
- [ ] executar `docs/manual-smoke-test.md`

### Admin

- [ ] validar login e logout do admin
- [ ] validar listagem de pedidos
- [ ] validar alteracao de status
- [ ] validar edicao de produto
- [ ] validar upload de imagem
- [ ] validar importacao por lote da Tiny/Olist
- [ ] validar importacao por SKU da Tiny/Olist
- [ ] validar exclusao de produto importado sem reimportacao automatica
- [ ] validar cron da VPS do sync e conferir log de execucao

### SEO e indexacao

- [x] `robots.ts`
- [x] `sitemap.ts`
- [x] `manifest.ts`
- [x] metadata basica e Open Graph
- [ ] revisar `SITE_URL` em producao

### Pendencias nao bloqueantes

- [ ] integrar frete real
- [ ] revisar placeholders da conta para fase 2
- [ ] remover arquivos `.zip` do workspace quando nao forem mais necessarios
