import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDashboardSnapshot } from "@/lib/analysis/engine";

export const revalidate = 60;

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot();

  return <DashboardShell analyses={snapshot.analyses} statusItems={snapshot.statusItems} oilAlert={snapshot.oilAlert} />;
}