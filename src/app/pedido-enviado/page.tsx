import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{
    id?: string;
    orderId?: string;
    order?: string;
  }>;
};

export default async function PedidoEnviado({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const order =
    resolvedSearchParams.id ||
    resolvedSearchParams.orderId ||
    resolvedSearchParams.order;

  if (order) {
    redirect(`/pedidos/sucesso?id=${encodeURIComponent(order)}`);
  }

  redirect("/meus-pedidos");
}
