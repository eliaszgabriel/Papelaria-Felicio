import InfoPageLayout from "@/components/content/InfoPageLayout";

export default function SobreNosPage() {
  return (
    <InfoPageLayout
      eyebrow="Institucional"
      title="Sobre nós"
      intro="A Papelaria Felicio nasceu para reunir produtos bonitos, úteis e cheios de carinho para a rotina de estudos, organização e presentes."
      sections={[
        {
          title: "Nosso jeito de vender",
          body: [
            "A curadoria da loja valoriza peças delicadas, estampas fofas e itens que transformam a compra em uma experiência mais gostosa.",
            "A ideia é oferecer uma papelaria com clima leve, visual bonito e navegação simples para o cliente encontrar o que precisa sem esforço.",
          ],
        },
        {
          title: "Atendimento",
          body: [
            "Gostamos de manter um atendimento próximo, claro e humano em todas as etapas do pedido.",
            "Se surgir qualquer dúvida sobre produto, pagamento ou entrega, a nossa equipe está pronta para ajudar.",
          ],
        },
        {
          title: "Curadoria",
          body: [
            "Selecionamos itens que funcionam bem para presentes, rotina escolar, organização e detalhes criativos do dia a dia.",
            "Por isso a vitrine da loja está sempre girando entre novidades, destaques e ofertas especiais.",
          ],
        },
      ]}
    />
  );
}
