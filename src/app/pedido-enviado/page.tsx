import { redirect } from "next/navigation";

type Props = {
  searchParams: {
    id?: string;
    orderId?: string;
    order?: string;
  };
};

export default function PedidoEnviado({ searchParams }: Props) {
  const order = searchParams.id || searchParams.orderId || searchParams.order;

  if (order) {
    redirect(`/pedidos/sucesso?id=${encodeURIComponent(order)}`);
  }

  redirect("/meus-pedidos");
}
