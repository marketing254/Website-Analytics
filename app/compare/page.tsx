"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { CompareView } from "@/components/compare-view";

export default function ComparePage() {
  return <DashboardShell>{({ dashboards }) => <CompareView dashboards={dashboards} />}</DashboardShell>;
}
