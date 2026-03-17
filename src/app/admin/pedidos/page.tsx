import AdminOrdersClient from "./AdminOrdersClient";
import { requireAdminPage } from "@/lib/adminPage";

export default async function Page() {
  await requireAdminPage();
  return <AdminOrdersClient />;
}
