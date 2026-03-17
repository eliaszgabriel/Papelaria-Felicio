import InfoPageLayout from "@/components/content/InfoPageLayout";

export default function TermosDeUsoPage() {
  return (
    <InfoPageLayout
      eyebrow="Institucional"
      title="Termos de uso"
      intro="Ao navegar, se cadastrar e comprar na loja, o cliente concorda com as condições básicas de uso da plataforma, processamento dos pedidos e atendimento da Papelaria Felicio."
      sections={[
        {
          title: "1. Uso da plataforma",
          body: [
            "As informações exibidas na loja, incluindo preços, descrições, imagens, disponibilidade e organização do catálogo, podem ser atualizadas a qualquer momento.",
            "Ao utilizar o site, o cliente se compromete a informar dados corretos no cadastro, no checkout e nos canais de atendimento.",
          ],
        },
        {
          title: "2. Pedidos e disponibilidade",
          body: [
            "A confirmação do pedido depende da aprovação do pagamento e da disponibilidade real do item no momento do processamento.",
            "Se houver qualquer divergência operacional, a equipe entrará em contato para orientar a melhor solução, incluindo ajuste, troca ou cancelamento, quando necessário.",
          ],
        },
        {
          title: "3. Conta do cliente",
          body: [
            "O cliente é responsável por manter seus dados atualizados e preservar a confidencialidade de acesso à própria conta.",
            "A loja pode limitar, suspender ou revisar acessos em caso de uso indevido, tentativa de fraude ou comportamento que comprometa a operação.",
          ],
        },
        {
          title: "4. Atendimento e atualizações",
          body: [
            "Dúvidas sobre produtos, pedidos, pagamentos e comunicações devem ser tratadas pelos canais oficiais da Papelaria Felicio.",
            "Estes termos podem ser atualizados conforme a operação evoluir, sempre buscando clareza e boa experiência para o cliente.",
          ],
        },
      ]}
    />
  );
}
