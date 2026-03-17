import AdminProductsClient from "./AdminProductsClient";
import { requireAdminPage } from "@/lib/adminPage";

export default async function Page() {
  await requireAdminPage();
  return <AdminProductsClient />;
}
