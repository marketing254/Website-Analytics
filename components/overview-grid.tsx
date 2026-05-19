"use client";

import Link from "next/link";
import { Activity, ArrowUpRight, BarChart3, Eye, MousePointerClick, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WeeklyBarChart, type WeeklyDatum } from "@/components/charts/weekly-bar-chart";
import { cn, daysSince, formatDate, formatNumber } from "@/lib/utils";
import type { SiteDashboard } from "@/lib/types";

interface Props {
  dashboards: SiteDashboard[];
}

export function OverviewGrid({ dashboards }: Props) {
  if (!dashboards.length) {
    return (
      <Card>
        <CardContent className="grid place-items-center py-16">
          <p className="text-sm text-muted-foreground">No configured sites yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {dashboards.map((d) => (
        <SiteOverviewCard key={d.site.id} dashboard={d} />
      ))}
    </div>
  );
}

function SiteOverviewCard({ dashboard }: { dashboard: SiteDashboard }) {
  const latest = [...dashboard.comparison.weeks]
    .reverse()
    .find((w) => w.phase === "After revamp" && !w.isFuture && w.hasData);

  const sessionsLift = latest?.comparisonToBaseline.sessions ?? null;
  const viewsLift = latest?.comparisonToBaseline.screenPageViews ?? null;
  const eventsCountLift = latest?.comparisonToBaseline.eventCount ?? null;
  const keyEventsLift = latest?.comparisonToBaseline.keyEvents ?? null;

  const days = daysSince(dashboard.comparison.launchDate);
  const sinceLabel =
    days === null
      ? "—"
      : days >= 0
      ? `${days} day${days === 1 ? "" : "s"} since launch`
      : `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} until launch`;

  const weeklyData: WeeklyDatum[] = dashboard.comparison.weeks.map((w) => ({
    id: w.id,
    label: w.label,
    startDate: w.startDate,
    endDate: w.endDate,
    phase: w.phase,
    isPartial: w.isPartial,
    isFuture: w.isFuture,
    sessions: w.metrics.sessions,
    users: w.metrics.activeUsers,
    views: w.metrics.screenPageViews,
    events: w.metrics.eventCount,
    keyEvents: w.metrics.keyEvents
  }));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{dashboard.site.name}</CardTitle>
            <Badge variant="success" className="gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              {formatNumber(dashboard.realtime.metrics.activeUsers)} live
            </Badge>
          </div>
          <CardDescription>
            {dashboard.site.domain ? <span>{dashboard.site.domain} · </span> : null}
            Launched {formatDate(dashboard.comparison.launchDate)} · {sinceLabel}
          </CardDescription>
        </div>
        <Link
          href={`/sites/${dashboard.site.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View detail
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <MiniStat icon={Activity} label="Active now" value={formatNumber(dashboard.realtime.metrics.activeUsers)} live />
          <MiniStat
            icon={BarChart3}
            label="Sessions"
            value={latest ? formatNumber(latest.metrics.sessions) : "—"}
            delta={sessionsLift}
          />
          <MiniStat
            icon={Eye}
            label="Views"
            value={latest ? formatNumber(latest.metrics.screenPageViews) : "—"}
            delta={viewsLift}
          />
          <MiniStat
            icon={Zap}
            label="Events"
            value={latest ? formatNumber(latest.metrics.eventCount) : "—"}
            delta={eventsCountLift}
          />
          <MiniStat
            icon={MousePointerClick}
            label="Key events"
            value={latest ? formatNumber(latest.metrics.keyEvents) : "—"}
            delta={keyEventsLift}
          />
        </div>

        <div className="rounded-lg border bg-card/50 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider">Sessions by week</span>
            <span>Baseline {formatNumber(dashboard.comparison.baseline.sessions)} / wk</span>
          </div>
          <WeeklyBarChart data={weeklyData} baseline={dashboard.comparison.baseline.sessions} metric="sessions" />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border bg-card/50 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Top channel</p>
            {dashboard.acquisition[0] ? (
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-medium">{dashboard.acquisition[0].channel}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(dashboard.acquisition[0].sessions)}
                </span>
              </div>
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </div>
          <div className="rounded-lg border bg-card/50 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Top page</p>
            {dashboard.pages[0] ? (
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-medium" title={dashboard.pages[0].title}>
                  {dashboard.pages[0].title || dashboard.pages[0].path}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(dashboard.pages[0].pageViews)}
                </span>
              </div>
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  delta,
  live
}: {
  icon: any;
  label: string;
  value: string;
  delta?: number | null;
  live?: boolean;
}) {
  const cls = delta === null || delta === undefined || delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-success" : "text-destructive";
  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <p className={cn("text-base font-semibold tabular-nums", live ? "text-foreground" : cls)}>{value}</p>
    </div>
  );
}
