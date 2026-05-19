"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  FileText,
  History,
  Info,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDate, formatNumber, formatPercent } from "@/lib/utils";
import {
  aggregateTopChannels,
  aggregateTopEvents,
  aggregateTopPages,
  type HistoricalBaseline
} from "@/lib/historical";
import type { SiteDashboard } from "@/lib/types";

interface Props {
  dashboards: SiteDashboard[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.max(1, Math.floor((b - a) / DAY_MS) + 1);
}

function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1]} ${y}`;
}

export function CompareView({ dashboards }: Props) {
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
    <div className="space-y-6">
      <Card className="border-primary/10 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Pre-revamp vs post-revamp
          </CardTitle>
          <CardDescription>
            Old analytics are hardcoded from CSV snapshots of the previous Google Analytics property.
            Lift percentages are normalized to monthly rates so different window lengths compare fairly.
          </CardDescription>
        </CardHeader>
      </Card>

      {dashboards.map((d) => (
        <SiteRevampCompare key={d.site.id} dashboard={d} />
      ))}
    </div>
  );
}

interface Totals {
  activeUsers: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  eventCount: number;
  keyEvents: number;
}

interface PostMonth {
  month: string;
  dayCount: number;
  sessions: number;
  users: number;
  views: number;
  events: number;
  keyEvents: number;
}

function SiteRevampCompare({ dashboard }: { dashboard: SiteDashboard }) {
  const baseline = dashboard.historicalBaseline;
  const launchDate = dashboard.comparison.launchDate;

  // Post-revamp aggregate from daily trend (we already fetch up to 60 days).
  // This is more accurate than using the launch-relative weekly buckets because it lets us
  // bucket by calendar month.
  const post = useMemo(() => {
    const postDays = dashboard.trend.filter((p) => p.date >= launchDate);
    const totals: Totals = postDays.reduce(
      (acc, p) => {
        acc.activeUsers += p.activeUsers;
        acc.newUsers += 0;
        acc.sessions += p.sessions;
        acc.pageViews += p.screenPageViews;
        acc.eventCount += p.eventCount;
        acc.keyEvents += p.keyEvents;
        return acc;
      },
      { activeUsers: 0, newUsers: 0, sessions: 0, pageViews: 0, eventCount: 0, keyEvents: 0 }
    );

    // Group post days into monthly buckets.
    const byMonth = new Map<string, PostMonth>();
    for (const p of postDays) {
      const month = p.date.slice(0, 7);
      const cur =
        byMonth.get(month) ||
        { month, dayCount: 0, sessions: 0, users: 0, views: 0, events: 0, keyEvents: 0 };
      cur.dayCount += 1;
      cur.sessions += p.sessions;
      cur.users += p.activeUsers;
      cur.views += p.screenPageViews;
      cur.events += p.eventCount;
      cur.keyEvents += p.keyEvents;
      byMonth.set(month, cur);
    }
    const months = Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));

    return { totals, dayCount: postDays.length, months };
  }, [dashboard, launchDate]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{dashboard.site.name}</CardTitle>
            <CardDescription>
              {dashboard.site.domain ? <span>{dashboard.site.domain} · </span> : null}
              Relaunched <strong className="text-foreground">{formatDate(launchDate)}</strong>
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="muted" className="gap-1">
              <History className="h-3 w-3" />
              Old · {baseline ? formatDate(baseline.dateRange.from) + " → " + formatDate(baseline.dateRange.to) : "no data"}
            </Badge>
            <Badge variant="success" className="gap-1">
              <Sparkles className="h-3 w-3" />
              New · {post.dayCount} day{post.dayCount === 1 ? "" : "s"} since launch
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {baseline ? (
          <>
            <NormalizationNote baseline={baseline} post={post} />
            <MetricGrid baseline={baseline} post={post} />

            <Tabs defaultValue="breakdown">
              <TabsList>
                <TabsTrigger value="breakdown">Metric breakdown</TabsTrigger>
                <TabsTrigger value="monthly">Monthly view</TabsTrigger>
                <TabsTrigger value="channels">Channels</TabsTrigger>
                <TabsTrigger value="pages">Pages</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
              </TabsList>

              <TabsContent value="breakdown">
                <MetricTable baseline={baseline} post={post} />
              </TabsContent>

              <TabsContent value="monthly" className="space-y-3">
                <MonthlyTable
                  title="Pre-revamp · monthly (from CSVs)"
                  rows={baseline.months.map((m) => ({
                    label: m.label,
                    sub: m.sourceFile,
                    dayCount: daysBetween(m.from, m.to),
                    sessions: m.totals.sessions,
                    users: m.totals.activeUsers,
                    views: m.totals.pageViews,
                    events: m.totals.eventCount,
                    keyEvents: m.totals.keyEvents,
                    partial: false
                  }))}
                />
                <MonthlyTable
                  title="Post-revamp · monthly (live GA4)"
                  rows={post.months.map((m) => ({
                    label: monthLabel(m.month),
                    sub: `${m.dayCount} day${m.dayCount === 1 ? "" : "s"} of data`,
                    dayCount: m.dayCount,
                    sessions: m.sessions,
                    users: m.users,
                    views: m.views,
                    events: m.events,
                    keyEvents: m.keyEvents,
                    partial: m.dayCount < 28
                  }))}
                  emptyHint="No post-revamp daily data yet — check back after the launch."
                />
              </TabsContent>

              <TabsContent value="channels">
                <ChannelsCompare baseline={baseline} dashboard={dashboard} />
              </TabsContent>

              <TabsContent value="pages">
                <PagesCompare baseline={baseline} dashboard={dashboard} />
              </TabsContent>

              <TabsContent value="events">
                <EventsCompare baseline={baseline} dashboard={dashboard} />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="grid place-items-center rounded-lg border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
            <p>
              No historical CSV data found for <code className="rounded bg-muted px-1 py-0.5 text-xs">{dashboard.site.id}</code>.
              Drop CSVs in the repo root and re-run <code className="rounded bg-muted px-1 py-0.5 text-xs">node scripts/build-historical-baselines.mjs</code>.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface Post {
  totals: Totals;
  dayCount: number;
  months: PostMonth[];
}

function NormalizationNote({ baseline, post }: { baseline: HistoricalBaseline; post: Post }) {
  const oldDays = daysBetween(baseline.dateRange.from, baseline.dateRange.to);
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <p>
        Pre-revamp window: <strong className="text-foreground">{oldDays} days</strong>. Post-revamp window:{" "}
        <strong className="text-foreground">{post.dayCount} day{post.dayCount === 1 ? "" : "s"}</strong>.
        Totals shown are <strong>actual GA4 counts</strong>. The lift % comes from comparing{" "}
        <strong>daily averages</strong> (total ÷ days), not projections.
      </p>
    </div>
  );
}

function liftPercent(post: number, pre: number): number | null {
  if (!pre) return post ? null : 0;
  return ((post - pre) / pre) * 100;
}

function dailyAverage(total: number, dayCount: number): number {
  if (!dayCount) return 0;
  return total / dayCount;
}

function formatRate(value: number): string {
  if (value === 0) return "0";
  if (value < 10) return value.toFixed(1);
  return formatNumber(Math.round(value));
}

function MetricGrid({ baseline, post }: { baseline: HistoricalBaseline; post: Post }) {
  const oldDays = daysBetween(baseline.dateRange.from, baseline.dateRange.to);
  const newDays = post.dayCount;

  const tiles = [
    { label: "Sessions", pre: baseline.totals.sessions, post: post.totals.sessions },
    { label: "Active users", pre: baseline.totals.activeUsers, post: post.totals.activeUsers },
    { label: "Page views", pre: baseline.totals.pageViews, post: post.totals.pageViews },
    { label: "Events", pre: baseline.totals.eventCount, post: post.totals.eventCount },
    { label: "Key events", pre: baseline.totals.keyEvents, post: post.totals.keyEvents }
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map((tile) => (
        <CompareTile key={tile.label} {...tile} oldDays={oldDays} newDays={newDays} />
      ))}
    </div>
  );
}

function CompareTile({
  label,
  pre,
  post,
  oldDays,
  newDays
}: {
  label: string;
  pre: number;
  post: number;
  oldDays: number;
  newDays: number;
}) {
  const preAvg = dailyAverage(pre, oldDays);
  const postAvg = dailyAverage(post, newDays);
  const lift = liftPercent(postAvg, preAvg);
  const liftClass =
    lift === null || lift === 0 ? "text-muted-foreground" : lift > 0 ? "text-success" : "text-destructive";
  const Icon = lift === null || lift === 0 ? ArrowRight : lift > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Old · {oldDays}d</p>
          <p className="text-lg font-semibold tabular-nums">{formatNumber(pre)}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums">{formatRate(preAvg)} / day</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">New · {newDays}d</p>
          <p className="text-lg font-semibold tabular-nums text-primary">{formatNumber(post)}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums">{formatRate(postAvg)} / day</p>
        </div>
      </div>
      <div className={cn("mt-2 flex items-center gap-1 text-xs font-semibold", liftClass)}>
        <Icon className="h-3 w-3" />
        {lift === null ? "n/a" : formatPercent(lift)}
        <span className="font-normal text-muted-foreground">
          {lift !== null && lift !== 0 ? "daily avg" : ""}
        </span>
      </div>
    </div>
  );
}

function MetricTable({ baseline, post }: { baseline: HistoricalBaseline; post: Post }) {
  const oldDays = daysBetween(baseline.dateRange.from, baseline.dateRange.to);
  const newDays = post.dayCount;

  const rows = [
    { label: "Sessions", pre: baseline.totals.sessions, post: post.totals.sessions },
    { label: "Active users", pre: baseline.totals.activeUsers, post: post.totals.activeUsers },
    { label: "Page views", pre: baseline.totals.pageViews, post: post.totals.pageViews },
    { label: "Event count", pre: baseline.totals.eventCount, post: post.totals.eventCount },
    { label: "Key events", pre: baseline.totals.keyEvents, post: post.totals.keyEvents }
  ];

  return (
    <Card className="overflow-hidden border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Metric</TableHead>
            <TableHead className="text-right">
              Old total
              <span className="ml-1 text-[9px] font-normal text-muted-foreground/70">({oldDays}d)</span>
            </TableHead>
            <TableHead className="text-right">
              New total
              <span className="ml-1 text-[9px] font-normal text-muted-foreground/70">({newDays}d)</span>
            </TableHead>
            <TableHead className="text-right">Old · /day</TableHead>
            <TableHead className="text-right">New · /day</TableHead>
            <TableHead className="pr-6 text-right">Change (daily avg)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const preAvg = dailyAverage(row.pre, oldDays);
            const postAvg = dailyAverage(row.post, newDays);
            const lift = liftPercent(postAvg, preAvg);
            const liftClass =
              lift === null || lift === 0 ? "text-muted-foreground" : lift > 0 ? "text-success" : "text-destructive";
            return (
              <TableRow key={row.label}>
                <TableCell className="pl-6 font-medium">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(row.pre)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatNumber(row.post)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatRate(preAvg)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatRate(postAvg)}</TableCell>
                <TableCell className={cn("pr-6 text-right tabular-nums font-semibold", liftClass)}>
                  {lift === null ? "n/a" : formatPercent(lift)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

interface MonthlyRow {
  label: string;
  sub: string;
  dayCount: number;
  sessions: number;
  users: number;
  views: number;
  events: number;
  keyEvents: number;
  partial: boolean;
}

function MonthlyTable({
  title,
  rows,
  emptyHint
}: {
  title: string;
  rows: MonthlyRow[];
  emptyHint?: string;
}) {
  return (
    <Card className="overflow-hidden border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      {rows.length === 0 ? (
        <div className="px-6 pb-5 text-xs text-muted-foreground">{emptyHint || "No data."}</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Month</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead className="text-right">Page views</TableHead>
              <TableHead className="text-right">Events</TableHead>
              <TableHead className="pr-6 text-right">Key events</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.label}>
                <TableCell className="pl-6">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.label}</span>
                    {m.partial ? (
                      <Badge variant="warning" className="text-[10px]">
                        partial · {m.dayCount}d
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground">{m.sub}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(m.sessions)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(m.users)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(m.views)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(m.events)}</TableCell>
                <TableCell className="pr-6 text-right tabular-nums">{formatNumber(m.keyEvents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function ChannelsCompare({ baseline, dashboard }: { baseline: HistoricalBaseline; dashboard: SiteDashboard }) {
  const oldChannels = aggregateTopChannels(baseline);
  const newChannels = dashboard.acquisition.map((c) => ({ channel: c.channel, sessions: c.sessions }));

  return (
    <SideBySideList
      leftTitle="Old site · channels"
      leftSub={`${baseline.dateRange.from} → ${baseline.dateRange.to}`}
      rightTitle="Revamped site · channels"
      rightSub="last 28 days"
      left={oldChannels.map((c) => ({ name: c.channel, value: c.sessions }))}
      right={newChannels.map((c) => ({ name: c.channel, value: c.sessions }))}
      unitLabel="sessions"
    />
  );
}

function PagesCompare({ baseline, dashboard }: { baseline: HistoricalBaseline; dashboard: SiteDashboard }) {
  const oldPages = aggregateTopPages(baseline);
  const newPages = dashboard.pages.map((p) => ({ name: p.title || p.path, value: p.pageViews }));

  return (
    <SideBySideList
      leftTitle="Old site · top pages"
      leftSub={`${baseline.dateRange.from} → ${baseline.dateRange.to}`}
      rightTitle="Revamped site · top pages"
      rightSub="last 28 days"
      left={oldPages.map((p) => ({ name: p.title, value: p.pageViews }))}
      right={newPages}
      unitLabel="views"
    />
  );
}

function EventsCompare({ baseline, dashboard }: { baseline: HistoricalBaseline; dashboard: SiteDashboard }) {
  const oldEvents = aggregateTopEvents(baseline);
  const newEvents = dashboard.topEvents.map((e) => ({ name: e.name, value: e.eventCount }));

  return (
    <SideBySideList
      leftTitle="Old site · top events"
      leftSub={`${baseline.dateRange.from} → ${baseline.dateRange.to}`}
      rightTitle="Revamped site · top events"
      rightSub="last 28 days"
      left={oldEvents.map((e) => ({ name: e.name, value: e.eventCount }))}
      right={newEvents}
      unitLabel="events"
    />
  );
}

interface SideItem {
  name: string;
  value: number;
}

function SideBySideList({
  leftTitle,
  leftSub,
  rightTitle,
  rightSub,
  left,
  right,
  unitLabel
}: {
  leftTitle: string;
  leftSub: string;
  rightTitle: string;
  rightSub: string;
  left: SideItem[];
  right: SideItem[];
  unitLabel: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-3.5 w-3.5 text-muted-foreground" />
            {leftTitle}
          </CardTitle>
          <CardDescription>{leftSub}</CardDescription>
        </CardHeader>
        <CardContent>
          <RankRows items={left} unitLabel={unitLabel} accent="hsl(var(--muted-foreground))" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {rightTitle}
          </CardTitle>
          <CardDescription>{rightSub}</CardDescription>
        </CardHeader>
        <CardContent>
          <RankRows items={right} unitLabel={unitLabel} accent="hsl(var(--chart-1))" />
        </CardContent>
      </Card>
    </div>
  );
}

function RankRows({ items, unitLabel, accent }: { items: SideItem[]; unitLabel: string; accent: string }) {
  const showAll = useCollapsibleList(items.length, 8);

  if (!items.length) {
    return (
      <div className="grid place-items-center rounded-lg border border-dashed bg-muted/30 p-6 text-center text-xs text-muted-foreground">
        <FileText className="mb-1 h-4 w-4" />
        No data
      </div>
    );
  }

  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="space-y-2">
      {items.slice(0, showAll.count).map((item) => {
        const pct = (item.value / max) * 100;
        return (
          <div key={item.name} className="rounded-md border bg-card px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium" title={item.name}>
                {item.name}
              </p>
              <p className="shrink-0 text-xs font-semibold tabular-nums">
                {formatNumber(item.value)} <span className="font-normal text-muted-foreground">{unitLabel}</span>
              </p>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
            </div>
          </div>
        );
      })}
      {items.length > showAll.count ? (
        <button
          type="button"
          onClick={showAll.expand}
          className="block w-full rounded-md border border-dashed bg-card/30 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50"
        >
          Show {items.length - showAll.count} more
        </button>
      ) : null}
    </div>
  );
}

function useCollapsibleList(total: number, initial: number) {
  const [count, setCount] = useState(Math.min(initial, total));
  return {
    count,
    expand: () => setCount(total)
  };
}
