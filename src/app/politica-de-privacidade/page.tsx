import InfoPageLayout from "@/components/content/InfoPageLayout";

export default function PoliticaDePrivacidadePage() {
  return (
    <InfoPageLayout
      eyebrow="Privacidade"
      title="Política de privacidade"
      intro="Respeitamos os dados dos nossos clientes e utilizamos as informações apenas para operar a loja com segurança, transparência e um atendimento mais eficiente."
      sections={[
        {
          title: "1. Dados coletados",
          body: [
            "Os dados informados no cadastro, checkout e atendimento podem incluir nome, email, telefone, endereço, CPF e informações relacionadas ao pedido.",
            "Esses dados são utilizados para processar compras, gerar histórico, acompanhar entregas, confirmar pagamentos e atender o cliente.",
          ],
        },
        {
          title: "2. Uso das informações",
          body: [
            "As informações são tratadas para operação da loja, comunicação sobre a compra, suporte, atualização de pedido e melhoria do atendimento.",
            "Não utilizamos os dados do cliente para finalidades indevidas e restringimos o acesso ao necessário para a operação.",
          ],
        },
        {
          title: "3. Segurança",
          body: [
            "Adotamos medidas para reduzir a exposição de dados sensíveis, especialmente em autenticação, administração da loja e fluxo de pagamento.",
            "Mesmo com cuidados técnicos e operacionais, nenhum ambiente digital está totalmente livre de riscos, por isso seguimos revisando e melhorando a segurança do site.",
          ],
        },
        {
          title: "4. Contato e atualização de dados",
          body: [
            "Se você tiver dúvidas sobre privacidade, quiser atualizar informações ou solicitar esclarecimentos sobre uso de dados, entre em contato pelos canais oficiais da Papelaria Felicio.",
            "Nosso compromisso é tratar essas informações com responsabilidade, clareza e respeito.",
          ],
        },
      ]}
    />
  );
}
