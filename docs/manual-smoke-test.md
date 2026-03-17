# Manual Smoke Test

## Preparacao

1. Rode `npm run verify`
2. Suba o projeto com `npm run dev`
3. Confirme que `http://localhost:3000/api/health` responde `ok: true`
4. Garanta que o banco de teste tem pelo menos um produto ativo com estoque

## Fluxo guest

1. Abrir a home
2. Entrar em um produto
3. Adicionar ao carrinho
4. Ir para o checkout
5. Preencher:
   - nome
   - WhatsApp
   - CPF valido
   - email
   - CEP valido
   - numero do endereco
6. Confirmar que o frete foi calculado
7. Finalizar compra com Pix
8. Confirmar redirecionamento para `/pedidos/sucesso`
9. Confirmar exibição de:
   - total
   - itens
   - copia e cola Pix
10. Abrir `Meus pedidos` com o token guest salvo no navegador

## Fluxo logado

1. Criar conta ou entrar com uma conta existente
2. Repetir compra com usuario autenticado
3. Confirmar que:
   - dados basicos foram preenchidos automaticamente
   - endereco padrao aparece no checkout
   - pedido aparece em `/meus-pedidos`

## Webhook e pagamento

1. Gerar pedido Pix
2. Simular ou confirmar pagamento no provedor
3. Confirmar que o webhook muda o pedido para `pago`
4. Confirmar que o estoque foi abatido
5. Confirmar que a tela do pedido mostra o novo status

## Admin

1. Acessar `/admin/login`
2. Entrar com `ADMIN_KEY`
3. Validar:
   - listagem de pedidos
   - filtro por status
   - detalhe do pedido
   - alteracao de status
   - listagem de produtos
   - edicao de produto
   - upload de imagem

## Conta do cliente

1. Abrir `/conta`
2. Validar:
   - resumo
   - edicao de perfil
   - alterar senha
   - enderecos
   - wishlist

## Criterio de aprovado

- nenhum erro de console critico no fluxo principal
- pedido criado corretamente
- pagamento refletido no pedido
- estoque preservado
- admin acessivel apenas com sessao
- `npm run verify` passando
