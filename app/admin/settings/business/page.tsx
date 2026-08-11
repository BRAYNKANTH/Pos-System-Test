import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import BusinessSettingsClient from "./BusinessSettingsClient";

export const dynamic = "force-dynamic";

export default async function BusinessSettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/");
  }

  return <BusinessSettingsClient />;
}
