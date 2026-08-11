import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import InvoiceSettingsClient from "./InvoiceSettingsClient";

export const dynamic = "force-dynamic";

export default async function InvoiceSettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/");
  }

  return <InvoiceSettingsClient />;
}
