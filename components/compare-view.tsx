"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Calendar, FileText, History, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDate, formatNumber, formatPercent } from "@/lib/utils";
import { aggregateTopChannels, aggregateTopEvents, aggregateTopPages, type HistoricalBaseline } from "@/lib/historical";
import type { SiteDashboard } from "@/lib/types";

interface Props {
  dashboards: SiteDashboard[];
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
            Old analytics data is hardcoded from CSV snapshots of the previous Google Analytics property (no longer collecting).
            Post-revamp data is live from the GA4 Data API.
          </CardDescription>
        </CardHeader>
      </Card>

      {dashboards.map((d) => (
        <SiteRevampCompare key={d.site.id} dashboard={d} />
      ))}
    </div>
  );
}

function SiteRevampCompare({ dashboard }: { dashboard: SiteDashboard }) {
  const baseline = dashboard.historicalBaseline;

  // Post-revamp aggregate = sum across all "After revamp" weeks that have GA4 data.
  const postRevamp = useMemo(() => {
    const completed = dashboard.comparison.weeks.filter((w) => w.phase === "After revamp" && !w.isFuture);
    const totals = completed.reduce(
      (sum, w) => {
        sum.activeUsers += w.metrics.activeUsers;
        sum.newUsers += w.metrics.newUsers;
        sum.sessions += w.metrics.sessions;
        sum.pageViews += w.metrics.screenPageViews;
        sum.eventCount += w.metrics.eventCount;
        sum.keyEvents += w.metrics.keyEvents;
        return sum;
      },
      { activeUsers: 0, newUsers: 0, sessions: 0, pageViews: 0, eventCount: 0, keyEvents: 0 }
    );
    return { weeks: completed, totals };
  }, [dashboard]);

  const launchDate = dashboard.comparison.launchDate;

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
              New · since {formatDate(launchDate)}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {baseline ? (
          <>
            <MetricGrid baseline={baseline} postRevamp={postRevamp.totals} />
            <Tabs defaultValue="breakdown">
              <TabsList>
                <TabsTrigger value="breakdown">Metric breakdown</TabsTrigger>
                <TabsTrigger value="channels">Channels</TabsTrigger>
                <TabsTrigger value="pages">Pages</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
              </TabsList>

              <TabsContent value="breakdown" className="space-y-3">
                <MetricTable baseline={baseline} postRevamp={postRevamp.totals} />
                <MonthlyTable baseline={baseline} />
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

interface Totals {
  activeUsers: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  eventCount: number;
  keyEvents: number;
}

function liftPercent(post: number, pre: number): number | null {
  if (!pre) return post ? null : 0;
  return ((post - pre) / pre) * 100;
}

function MetricGrid({ baseline, postRevamp }: { baseline: HistoricalBaseline; postRevamp: Totals }) {
  const tiles: { label: string; pre: number; post: number; format?: "compact" }[] = [
    { label: "Sessions", pre: baseline.totals.sessions, post: postRevamp.sessions },
    { label: "Active users", pre: baseline.totals.activeUsers, post: postRevamp.activeUsers },
    { label: "Page views", pre: baseline.totals.pageViews, post: postRevamp.pageViews },
    { label: "Events", pre: baseline.totals.eventCount, post: postRevamp.eventCount },
    { label: "Key events", pre: baseline.totals.keyEvents, post: postRevamp.keyEvents }
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map((tile) => (
        <CompareTile key={tile.label} {...tile} />
      ))}
    </div>
  );
}

function CompareTile({ label, pre, post }: { label: string; pre: number; post: number }) {
  const lift = liftPercent(post, pre);
  const liftClass = lift === null || lift === 0 ? "text-muted-foreground" : lift > 0 ? "text-success" : "text-destructive";
  const Icon = lift === null || lift === 0 ? ArrowRight : lift > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Old</p>
          <p className="text-lg font-semibold tabular-nums">{formatNumber(pre)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">New</p>
          <p className="text-lg font-semibold tabular-nums text-primary">{formatNumber(post)}</p>
        </div>
      </div>
      <div className={cn("mt-2 flex items-center gap-1 text-xs font-semibold", liftClass)}>
        <Icon className="h-3 w-3" />
        {lift === null ? "n/a" : formatPercent(lift)}
        <span className="text-muted-foreground font-normal">{lift !== null && lift !== 0 ? "vs old" : ""}</span>
      </div>
    </div>
  );
}

function MetricTable({ baseline, postRevamp }: { baseline: HistoricalBaseline; postRevamp: Totals }) {
  const rows: { label: string; pre: number; post: number }[] = [
    { label: "Sessions", pre: baseline.totals.sessions, post: postRevamp.sessions },
    { label: "Active users", pre: baseline.totals.activeUsers, post: postRevamp.activeUsers },
    { label: "New users", pre: baseline.totals.newUsers, post: postRevamp.newUsers },
    { label: "Page views", pre: baseline.totals.pageViews, post: postRevamp.pageViews },
    { label: "Event count", pre: baseline.totals.eventCount, post: postRevamp.eventCount },
    { label: "Key events", pre: baseline.totals.keyEvents, post: postRevamp.keyEvents }
  ];

  return (
    <Card className="overflow-hidden border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Metric</TableHead>
            <TableHead className="text-right">Old site</TableHead>
            <TableHead className="text-right">Revamped site</TableHead>
            <TableHead className="pr-6 text-right">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const lift = liftPercent(row.post, row.pre);
            const delta = row.post - row.pre;
            const liftClass = lift === null || lift === 0 ? "text-muted-foreground" : lift > 0 ? "text-success" : "text-destructive";
            return (
              <TableRow key={row.label}>
                <TableCell className="pl-6 font-medium">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(row.pre)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatNumber(row.post)}</TableCell>
                <TableCell className={cn("pr-6 text-right tabular-nums font-semibold", liftClass)}>
                  {lift === null ? "n/a" : formatPercent(lift)}
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    {delta > 0 ? "+" : ""}
                    {formatNumber(delta)}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function MonthlyTable({ baseline }: { baseline: HistoricalBaseline }) {
  return (
    <Card className="overflow-hidden border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          Pre-revamp monthly breakdown
        </CardTitle>
        <CardDescription>From CSV snapshots ({baseline.monthCount} {baseline.monthCount === 1 ? "month" : "months"})</CardDescription>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Month</TableHead>
            <TableHead className="text-right">Sessions</TableHead>
            <TableHead className="text-right">Users</TableHead>
            <TableHead className="text-right">Page views</TableHead>
            <TableHead className="pr-6 text-right">Events</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {baseline.months.map((m) => (
            <TableRow key={m.label}>
              <TableCell className="pl-6">
                <span className="font-medium">{m.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{m.sourceFile}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(m.totals.sessions)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(m.totals.activeUsers)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(m.totals.pageViews)}</TableCell>
              <TableCell className="pr-6 text-right tabular-nums">{formatNumber(m.totals.eventCount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
  if (!items.length) {
    return (
      <div className="grid place-items-center rounded-lg border border-dashed bg-muted/30 p-6 text-center text-xs text-muted-foreground">
        <FileText className="mb-1 h-4 w-4" />
        No data
      </div>
    );
  }

  const max = Math.max(1, ...items.map((i) => i.value));
  const showAll = useCollapsibleList(items.length, 8);

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

// Tiny helper so the side-by-side list can be collapsible without extra deps.
function useCollapsibleList(total: number, initial: number) {
  const [count, setCount] = useState(Math.min(initial, total));
  return {
    count,
    expand: () => setCount(total)
  };
}
