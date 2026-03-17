import InfoPageLayout from "@/components/content/InfoPageLayout";

export default function PagamentoPage() {
  return (
    <InfoPageLayout
      eyebrow="Pagamento"
      title="Formas de pagamento"
      intro="A compra pode ser concluída de forma simples, com confirmação clara e acompanhamento do pedido."
      sections={[
        {
          title: "Pix",
          body: [
            "O Pix é confirmado automaticamente assim que o pagamento é identificado, acelerando a liberação do pedido.",
            "Depois da aprovação, o status do pedido muda na conta do cliente e o email de confirmação é enviado.",
          ],
        },
        {
          title: "Cartão",
          body: [
    "O pagamento com cartão é processado com checkout seguro do Mercado Pago, em ambiente protegido.",
            "Após a aprovação da operadora, o pedido segue para preparação e você recebe a confirmação automaticamente.",
          ],
        },
        {
          title: "Segurança",
          body: [
            "Os dados sensíveis de pagamento não ficam expostos na loja e o fluxo é tratado por provedores especializados.",
            "Se houver qualquer falha ou dúvida no pagamento, o atendimento pode orientar o próximo passo.",
          ],
        },
      ]}
    />
  );
}
