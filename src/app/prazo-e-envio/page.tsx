import InfoPageLayout from "@/components/content/InfoPageLayout";

export default function PrazoEnvioPage() {
  return (
    <InfoPageLayout
      eyebrow="Entrega"
      title="Prazo e envio"
      intro="Organizamos cada pedido com carinho e buscamos manter o processo de separação e entrega o mais claro possível para você acompanhar sua compra com tranquilidade."
      sections={[
        {
          title: "1. Prazo de preparação",
          body: [
            "Pedidos aprovados em dias úteis entram em separação logo após a confirmação do pagamento.",
            "Em períodos de maior movimento, campanhas sazonais ou itens com reposição recente, o prazo de preparação pode variar um pouco mais.",
          ],
        },
        {
          title: "2. Prazo de transporte",
          body: [
            "O prazo total de entrega depende do CEP informado no checkout e da modalidade disponível para a sua região.",
            "Assim que o pedido for despachado, a loja pode atualizar o status para que você acompanhe o andamento pela sua conta.",
          ],
        },
        {
          title: "3. Conferência do endereço",
          body: [
            "Antes de concluir a compra, revise o endereço completo, incluindo número, complemento e CEP.",
            "Dados incompletos, incorretos ou ausentes podem gerar atraso, devolução do pacote e necessidade de novo reenvio.",
          ],
        },
        {
          title: "4. Dúvidas sobre entrega",
          body: [
            "Se surgir qualquer dúvida sobre prazo, transporte ou tentativas de entrega, fale com a equipe pelos canais oficiais da Papelaria Felicio.",
            "Nosso objetivo é acompanhar o pedido até ele chegar com segurança a você.",
          ],
        },
      ]}
    />
  );
}
