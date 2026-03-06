import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDashboardSnapshot } from "@/lib/analysis/engine";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot();

  return <DashboardShell analyses={snapshot.analyses} statusItems={snapshot.statusItems} />;
}