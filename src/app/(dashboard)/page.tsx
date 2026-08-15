import { auth } from "@/auth";
import { DashboardContent } from "@/components/dashboard-content";

export default async function DashboardPage() {
  const session = await auth();
  return <DashboardContent isAdmin={session?.user.role === "ADMIN"} />;
}
