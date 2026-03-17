import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/adminAuth";

export async function requireAdminPage() {
  const authorized = await isAdminSession();

  if (!authorized) {
    redirect("/admin/login");
  }
}
