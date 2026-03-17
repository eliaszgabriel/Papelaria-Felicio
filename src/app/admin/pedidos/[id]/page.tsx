import OrderDetailsAdmin from "./OrderDetailsAdmin";
import { requireAdminPage } from "@/lib/adminPage";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  await requireAdminPage();
  const { id } = await params;
  const orderId = decodeURIComponent(id);
  return <OrderDetailsAdmin orderId={orderId} />;
}
