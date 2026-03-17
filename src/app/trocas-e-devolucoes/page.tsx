import InfoPageLayout from "@/components/content/InfoPageLayout";

export default function TrocasDevolucoesPage() {
  return (
    <InfoPageLayout
      eyebrow="Atendimento"
      title="Trocas e devoluções"
      intro="Sua satisfação e tranquilidade fazem parte da experiência que queremos entregar. Se por algum motivo você não ficar satisfeito com a compra, vamos analisar o caso com carinho e seguir uma política simples e transparente para trocas, devoluções e reembolsos."
      sections={[
        {
          title: "1. Arrependimento e desistência",
          body: [
            "Se o produto estiver em perfeitas condições, mas não lhe agradar, você tem o prazo de **7 (sete) dias corridos**, contados a partir da data de recebimento, para solicitar a devolução ou troca do produto. Você deverá entrar em contato por email **papelariafelicio@gmail.com** ou WhatsApp **(41) 98901-5752**.",
            "Para iniciar o atendimento, informe o número do pedido, o motivo da solicitação e, se possível, fotos do produto e da embalagem.",
            "Como regra geral, o item devolvido deve voltar sem indícios de uso, na embalagem original, acompanhado da nota fiscal ou declaração de conteúdo e de todos os acessórios enviados.",
            "Produtos amassados, rasgados, sujos, fora da embalagem original ou com sinais de uso que comprometam a revenda podem não ser aceitos para troca por arrependimento.",
            "Depois da análise e confirmação das condições acima, você poderá optar por crédito na loja ou estorno do valor pago pelo mesmo método utilizado na compra.",
          ],
        },
        {
          title: "2. Produtos personalizados",
          body: [
            "Quando houver produto personalizado, produzido especialmente para o cliente, o direito de arrependimento pode não se aplicar, conforme as exceções previstas no Código de Defesa do Consumidor.",
            "Nesses casos, recomendamos sempre confirmar com a loja todas as características do item antes da conclusão do pedido.",
          ],
        },
        {
          title: "3. Processo e prazos de estorno",
          body: [
            "Assim que o produto devolvido chegar ao nosso endereço, ele será analisado em até 15 dias úteis. Se estiver tudo conforme, o processo de troca, crédito ou estorno será concluído.",
            "No cartão de crédito, o estorno pode ser solicitado rapidamente, mas o prazo de visualização na fatura depende da operadora do cartão e pode variar.",
            "Em pagamentos via Pix, o reembolso é feito para a mesma conta utilizada no pagamento, dentro do prazo operacional informado pela loja no momento da aprovação.",
            "Se o cancelamento for pedido depois do envio do pacote, será necessário aguardar a devolução física do produto e a análise das condições acima antes da liberação do reembolso.",
          ],
        },
        {
          title: "4. Itens que podem ser recusados",
          body: [
            "A loja se isenta da obrigação de trocar itens com danos causados por mau uso, solicitações feitas fora do prazo legal ou produtos devolvidos sem as condições mínimas para análise.",
            "Não serão aceitos, por exemplo: produtos sem embalagem original, sem etiqueta quando aplicável, avariados, incompletos, em desacordo com o pedido de devolução ou sem identificação mínima da compra.",
            "Se o pacote chegar com sinais de avaria, divergência ou falta de itens, o ideal é entrar em contato com a loja em até 72 horas após o recebimento.",
          ],
        },
        {
          title: "5. Outras ocorrências",
          body: [
            "Caso você identifique qualquer outra situação não descrita aqui, fale com a equipe antes de enviar o produto de volta.",
            "Itens enviados sem aviso prévio, fora do prazo ou em desacordo com esta política podem ser devolvidos ao remetente sem nova consulta.",
            "Nosso compromisso é buscar uma solução justa, clara e cuidadosa para cada atendimento.",
          ],
        },
      ]}
    />
  );
}
