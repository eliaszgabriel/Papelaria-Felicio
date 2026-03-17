import AdminProductEditClient from "./AdminProductEditClient";
import { requireAdminPage } from "@/lib/adminPage";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  return <AdminProductEditClient mode="edit" id={decodeURIComponent(id)} />;
}
