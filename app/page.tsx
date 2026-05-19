"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { OverviewGrid } from "@/components/overview-grid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export default function OverviewPage() {
  return (
    <DashboardShell>
      {({ dashboards }) => {
        const totalLive = dashboards.reduce((sum, d) => sum + (d.realtime.metrics.activeUsers || 0), 0);
        const totalEvents28d = dashboards.reduce(
          (sum, d) => sum + d.trend.reduce((s, p) => s + p.keyEvents, 0),
          0
        );
        const totalSessions28d = dashboards.reduce(
          (sum, d) => sum + d.trend.reduce((s, p) => s + p.sessions, 0),
          0
        );

        return (
          <div className="space-y-6">
            <Card className="overflow-hidden border-primary/10 bg-gradient-to-br from-primary/5 via-background to-background">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Launch performance overview</CardTitle>
                <CardDescription>
                  Realtime activity and post-launch lift across all configured websites.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                <SummaryStat label="Active right now" value={formatNumber(totalLive)} accent="success" />
                <SummaryStat label="Sessions · last 60 days" value={formatNumber(totalSessions28d)} />
                <SummaryStat label="Key events · last 60 days" value={formatNumber(totalEvents28d)} />
                <SummaryStat label="Sites tracked" value={String(dashboards.length)} />
              </CardContent>
            </Card>

            <OverviewGrid dashboards={dashboards} />

            <Card>
              <CardContent className="flex items-center justify-between p-4 text-sm">
                <p className="text-muted-foreground">Want a side-by-side breakdown?</p>
                <Link href="/compare" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                  Open the compare view
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
          </div>
        );
      }}
    </DashboardShell>
  );
}

function SummaryStat({ label, value, accent }: { label: string; value: string; accent?: "success" }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${
          accent === "success" ? "text-success" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
