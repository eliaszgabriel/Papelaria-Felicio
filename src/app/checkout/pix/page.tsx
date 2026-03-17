import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{
    id?: string;
    orderId?: string;
    order?: string;
  }>;
};

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  const orderId = params.id || params.orderId || params.order;

  if (!orderId) {
    redirect("/meus-pedidos");
  }

  redirect(`/pedidos/sucesso?id=${encodeURIComponent(orderId)}`);
}
