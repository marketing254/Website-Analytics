"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Eye, MousePointerClick, Sparkles, Users, Zap } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard } from "@/components/kpi-card";
import { WeeklyBarChart, type WeeklyDatum } from "@/components/charts/weekly-bar-chart";
import { DailyTrendChart } from "@/components/charts/daily-trend-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { RankList, type RankItem } from "@/components/rank-list";
import {
  cn,
  daysSince,
  formatDate,
  formatDuration,
  formatNumber,
  formatPercent
} from "@/lib/utils";
import type { SiteDashboard } from "@/lib/types";

interface Props {
  dashboard: SiteDashboard;
}

const metricOptions: { id: "sessions" | "users" | "views" | "events" | "keyEvents"; label: string }[] = [
  { id: "sessions", label: "Sessions" },
  { id: "users", label: "Users" },
  { id: "views", label: "Page views" },
  { id: "events", label: "Events" },
  { id: "keyEvents", label: "Key events" }
];

const trendMetric = {
  sessions: "sessions",
  users: "activeUsers",
  views: "screenPageViews",
  events: "eventCount",
  keyEvents: "keyEvents"
} as const;

export function SiteDetail({ dashboard }: Props) {
  const [metric, setMetric] = useState<(typeof metricOptions)[number]["id"]>("sessions");

  const weeklyData: WeeklyDatum[] = useMemo(
    () =>
      dashboard.comparison.weeks.map((w) => ({
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
      })),
    [dashboard]
  );

  const baselineMap = {
    sessions: dashboard.comparison.baseline.sessions,
    users: dashboard.comparison.baseline.activeUsers,
    views: dashboard.comparison.baseline.screenPageViews,
    events: dashboard.comparison.baseline.eventCount,
    keyEvents: dashboard.comparison.baseline.keyEvents
  } as const;

  const latestPostLaunch = useMemo(() => {
    return [...dashboard.comparison.weeks]
      .reverse()
      .find((w) => w.phase === "After revamp" && !w.isFuture && w.hasData);
  }, [dashboard]);

  const latestSessions = latestPostLaunch?.metrics.sessions ?? 0;
  const latestUsers = latestPostLaunch?.metrics.activeUsers ?? 0;
  const latestViews = latestPostLaunch?.metrics.screenPageViews ?? 0;
  const latestEventCount = latestPostLaunch?.metrics.eventCount ?? 0;
  const latestKeyEvents = latestPostLaunch?.metrics.keyEvents ?? 0;

  const sessionsLift = latestPostLaunch?.comparisonToBaseline.sessions ?? null;
  const viewsLift = latestPostLaunch?.comparisonToBaseline.screenPageViews ?? null;
  const eventCountLift = latestPostLaunch?.comparisonToBaseline.eventCount ?? null;
  const keyEventsLift = latestPostLaunch?.comparisonToBaseline.keyEvents ?? null;

  const launchDate = dashboard.comparison.launchDate;
  const firstData = dashboard.firstDataDate;
  const launchDateMismatch =
    firstData && launchDate && firstData > launchDate
      ? { firstData, launchDate, gapDays: Math.floor((new Date(`${firstData}T00:00:00Z`).getTime() - new Date(`${launchDate}T00:00:00Z`).getTime()) / 86400000) }
      : null;

  const totalSinceLaunch = dashboard.comparison.weeks
    .filter((w) => w.phase === "After revamp" && !w.isFuture)
    .reduce(
      (sum, w) => {
        sum.sessions += w.metrics.sessions;
        sum.users += w.metrics.activeUsers;
        sum.views += w.metrics.screenPageViews;
        sum.eventCount += w.metrics.eventCount;
        sum.keyEvents += w.metrics.keyEvents;
        return sum;
      },
      { sessions: 0, users: 0, views: 0, eventCount: 0, keyEvents: 0 }
    );

  const channelItems: RankItem[] = dashboard.acquisition.map((row) => ({
    key: row.channel,
    title: row.channel,
    subtitle: `${formatNumber(row.activeUsers)} users · ${formatNumber(row.keyEvents)} key events`,
    value: row.sessions,
    metricLabel: "sessions"
  }));

  const pageItems: RankItem[] = dashboard.pages.map((row) => ({
    key: row.path,
    title: row.title || row.path,
    subtitle: row.path,
    value: row.pageViews,
    metricLabel: "page views"
  }));

  const days = daysSince(dashboard.comparison.launchDate);
  const sinceLabel =
    days === null
      ? "—"
      : days >= 0
      ? `${days} day${days === 1 ? "" : "s"} since launch`
      : `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} until launch`;

  const totals28d = dashboard.trend.reduce(
    (sum, point) => {
      sum.sessions += point.sessions;
      sum.users += point.activeUsers;
      sum.views += point.screenPageViews;
      sum.events += point.eventCount;
      sum.keyEvents += point.keyEvents;
      return sum;
    },
    { sessions: 0, users: 0, views: 0, events: 0, keyEvents: 0 }
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4 p-5">
          <ContextBlock label="Site" value={dashboard.site.name} />
          <Divider />
          <ContextBlock label="Domain" value={dashboard.site.domain || "—"} />
          <Divider />
          <ContextBlock
            label="Launch date"
            value={
              <span>
                {formatDate(dashboard.comparison.launchDate)} <span className="font-normal text-muted-foreground">· {sinceLabel}</span>
              </span>
            }
          />
          <Divider />
          <ContextBlock
            label="Pre-launch baseline"
            value={
              <span>
                {formatNumber(dashboard.comparison.baseline.sessions)} <span className="font-normal text-muted-foreground">sessions/wk · </span>
                {formatNumber(dashboard.comparison.baseline.activeUsers)} <span className="font-normal text-muted-foreground">users/wk</span>
              </span>
            }
          />
        </CardContent>
      </Card>

      {launchDateMismatch ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                Configured launch date may be wrong
              </p>
              <p className="text-muted-foreground">
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{dashboard.site.id}</code> is configured to launch on{" "}
                <strong>{formatDate(launchDateMismatch.launchDate)}</strong>, but GA4 has no data before{" "}
                <strong>{formatDate(launchDateMismatch.firstData)}</strong> ({launchDateMismatch.gapDays} days later). The pre/post
                comparison window will be empty. Update <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">launchDate</code>{" "}
                in <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">config/sites.json</code> if needed.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Active now"
          value={formatNumber(dashboard.realtime.metrics.activeUsers)}
          deltaLabel={`Last 30 min · ${formatNumber(dashboard.realtime.metrics.eventCount)} events`}
          icon={Activity}
          accent="emerald"
          live
        />
        <KpiCard
          label="Sessions"
          value={formatNumber(latestSessions)}
          delta={sessionsLift}
          deltaLabel={latestPostLaunch ? `${latestPostLaunch.label} · ${formatPercent(sessionsLift)} vs baseline` : "No post-launch data yet"}
          icon={BarChart3}
          accent="blue"
        />
        <KpiCard
          label="Page views"
          value={formatNumber(latestViews)}
          delta={viewsLift}
          deltaLabel={latestPostLaunch ? `${latestPostLaunch.label} · ${formatPercent(viewsLift)} vs baseline` : "No post-launch data yet"}
          icon={Eye}
          accent="violet"
        />
        <KpiCard
          label="Events"
          value={formatNumber(latestEventCount)}
          delta={eventCountLift}
          deltaLabel={latestPostLaunch ? `${latestPostLaunch.label} · ${formatNumber(latestUsers)} users` : "No post-launch data yet"}
          icon={Zap}
          accent="amber"
        />
        <KpiCard
          label="Key events"
          value={formatNumber(latestKeyEvents)}
          delta={keyEventsLift}
          deltaLabel={latestPostLaunch ? `${latestPostLaunch.label} · conversions` : "No post-launch data yet"}
          icon={MousePointerClick}
          accent="rose"
        />
      </div>

      {totalSinceLaunch.sessions > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Cumulative since launch
            </CardTitle>
            <CardDescription>
              Totals across all completed and in-progress post-launch weeks shown in the comparison window.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <CumStat label="Sessions" value={formatNumber(totalSinceLaunch.sessions)} />
            <CumStat label="Users" value={formatNumber(totalSinceLaunch.users)} />
            <CumStat label="Page views" value={formatNumber(totalSinceLaunch.views)} />
            <CumStat label="Events" value={formatNumber(totalSinceLaunch.eventCount)} />
            <CumStat label="Key events" value={formatNumber(totalSinceLaunch.keyEvents)} />
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="weekly">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="weekly">Weekly comparison</TabsTrigger>
            <TabsTrigger value="trend">Daily trend</TabsTrigger>
            <TabsTrigger value="audience">Audience</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {metricOptions.map((m) => (
              <button
                key={m.id}
                onClick={() => setMetric(m.id)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  metric === m.id ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <TabsContent value="weekly" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Week-by-week {metricOptions.find((m) => m.id === metric)?.label.toLowerCase()}</CardTitle>
                <CardDescription>
                  Pre-launch weeks averaged to a baseline (dashed line) — post-launch weeks compared against it.
                </CardDescription>
              </div>
              <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
                <LegendDot color="#94a3b8" /> Before
                <LegendDot color="#2563eb" /> After
                <LegendDot color="#60a5fa" /> Partial
              </div>
            </CardHeader>
            <CardContent>
              <WeeklyBarChart data={weeklyData} baseline={baselineMap[metric]} metric={metric} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weekly breakdown</CardTitle>
              <CardDescription>All metrics across the launch window with deltas to baseline.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Phase</TableHead>
                    <TableHead>Date range</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                    <TableHead className="text-right">Key events</TableHead>
                    <TableHead className="pr-6 text-right">vs baseline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.comparison.weeks.map((w) => {
                    const change = w.comparisonToBaseline.sessions;
                    return (
                      <TableRow key={w.id}>
                        <TableCell className="pl-6">
                          <Badge
                            variant={w.isFuture ? "warning" : w.phase === "After revamp" ? "default" : "muted"}
                            className="font-medium"
                          >
                            {w.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(w.startDate)} → {formatDate(w.endDate)}
                          {w.isPartial ? <span className="ml-2 text-xs">(partial)</span> : null}
                          {w.isFuture ? <span className="ml-2 text-xs">(future)</span> : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(w.metrics.sessions)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(w.metrics.activeUsers)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(w.metrics.screenPageViews)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(w.metrics.eventCount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(w.metrics.keyEvents)}</TableCell>
                        <TableCell
                          className={cn(
                            "pr-6 text-right tabular-nums font-medium",
                            change === null || change === undefined || change === 0
                              ? "text-muted-foreground"
                              : change > 0
                              ? "text-success"
                              : "text-destructive"
                          )}
                        >
                          {formatPercent(change)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trend" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <SmallStat label="Sessions (60d)" value={formatNumber(totals28d.sessions)} icon={BarChart3} />
            <SmallStat label="Users (60d)" value={formatNumber(totals28d.users)} icon={Users} />
            <SmallStat label="Page views" value={formatNumber(totals28d.views)} icon={Eye} />
            <SmallStat label="Events" value={formatNumber(totals28d.events)} icon={Zap} />
            <SmallStat label="Key events" value={formatNumber(totals28d.keyEvents)} icon={MousePointerClick} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Daily trend</CardTitle>
              <CardDescription>
                Last 60 days of {metricOptions.find((m) => m.id === metric)?.label.toLowerCase()}, with the launch date marked.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DailyTrendChart
                data={dashboard.trend}
                launchDate={dashboard.comparison.launchDate}
                metric={trendMetric[metric]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audience" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top countries</CardTitle>
              <CardDescription>Share of sessions, last 28 days.</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard.countries.length ? (
                <DonutChart
                  data={dashboard.countries.map((c) => ({ name: c.country, value: c.sessions }))}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No country data.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Devices</CardTitle>
              <CardDescription>Sessions by device category, last 28 days.</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard.devices.length ? (
                <DonutChart
                  data={dashboard.devices.map((d) => ({ name: d.category, value: d.sessions }))}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No device data.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Traffic channels</CardTitle>
            <CardDescription>Sessions by default channel grouping · last 28 days</CardDescription>
          </CardHeader>
          <CardContent>
            <RankList items={channelItems} accent="hsl(var(--chart-1))" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top pages</CardTitle>
            <CardDescription>Most-viewed pages · last 28 days</CardDescription>
          </CardHeader>
          <CardContent>
            <RankList items={pageItems} accent="hsl(var(--chart-3))" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Top events
            </CardTitle>
            <CardDescription>Events triggered by users · last 28 days</CardDescription>
          </CardHeader>
          <CardContent>
            <RankList
              items={dashboard.topEvents.map((e) => ({
                key: e.name,
                title: e.name,
                subtitle: `${formatNumber(e.activeUsers)} users triggered this event`,
                value: e.eventCount,
                metricLabel: "events"
              }))}
              accent="hsl(var(--chart-4))"
              emptyMessage="No events recorded in the last 28 days."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Realtime by country</CardTitle>
            <CardDescription>Where active users are right now (last 30 minutes).</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.realtime.activeByCountry.length ? (
              <RankList
                items={dashboard.realtime.activeByCountry.map((c) => ({
                  key: c.country,
                  title: c.country,
                  value: c.activeUsers,
                  metricLabel: "active users"
                }))}
                accent="hsl(var(--chart-2))"
              />
            ) : (
              <p className="text-sm text-muted-foreground">No active users right now.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CumStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ContextBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function Divider() {
  return <div className="hidden h-9 w-px bg-border md:block" />;
}

function SmallStat({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums">{value}</p>
        </div>
        {Icon ? <Icon className="h-5 w-5 text-muted-foreground" /> : null}
      </CardContent>
    </Card>
  );
}

function LegendDot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />;
}
