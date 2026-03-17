import AdminProductEditClient from "../[id]/AdminProductEditClient";
import { requireAdminPage } from "@/lib/adminPage";

export default async function Page() {
  await requireAdminPage();
  return <AdminProductEditClient mode="create" />;
}
