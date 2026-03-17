import { redirect } from "next/navigation";
import AdminLoginClient from "./AdminLoginClient";
import { isAdminSession } from "@/lib/adminAuth";

export default async function AdminLoginPage() {
  const authorized = await isAdminSession();

  if (authorized) {
    redirect("/admin/pedidos");
  }

  return <AdminLoginClient />;
}
