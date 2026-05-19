import {
  buildLaunchWeekWindows,
  emptyMetrics,
  type MetricBundle,
  summarizeBaseline,
  todayDateOnly,
  type WeekWindow
} from "@/lib/dates";
import { getHistoricalBaseline, type HistoricalBaseline } from "@/lib/historical";
import {
  type Ga4Row,
  mapDimensionRow,
  mapMetricRow,
  runRealtimeReport,
  runReport
} from "@/lib/ga4";
import type { SiteConfig } from "@/lib/config";

const CORE_METRICS = [
  "activeUsers",
  "newUsers",
  "sessions",
  "screenPageViews",
  "eventCount",
  "keyEvents",
  "engagementRate",
  "averageSessionDuration"
] as const;

export interface RealtimeMetrics {
  activeUsers: number;
  screenPageViews: number;
  keyEvents: number;
  eventCount: number;
}

export interface DailyPoint {
  date: string;
  sessions: number;
  activeUsers: number;
  screenPageViews: number;
  eventCount: number;
  keyEvents: number;
}

export interface EventRow {
  name: string;
  eventCount: number;
  activeUsers: number;
}

export interface CountryRow {
  country: string;
  sessions: number;
  activeUsers: number;
}

export interface DeviceRow {
  category: string;
  sessions: number;
  activeUsers: number;
}

export interface AcquisitionRow {
  channel: string;
  sessions: number;
  activeUsers: number;
  keyEvents: number;
}

export interface PageRow {
  path: string;
  title: string;
  pageViews: number;
  activeUsers: number;
  keyEvents: number;
}

export interface WeekData extends WeekWindow {
  metrics: MetricBundle;
  hasData: boolean;
  comparisonToBaseline: Record<keyof MetricBundle, number | null>;
}

export interface SiteDashboard {
  site: SiteConfig & { setupMissing?: string[] };
  comparison: {
    launchDate: string;
    baseline: MetricBundle;
    weeks: WeekData[];
  };
  realtime: {
    generatedAt: string;
    window: string;
    metrics: RealtimeMetrics;
    activeByCountry: { country: string; activeUsers: number }[];
  };
  acquisition: AcquisitionRow[];
  pages: PageRow[];
  countries: CountryRow[];
  devices: DeviceRow[];
  trend: DailyPoint[];
  topEvents: EventRow[];
  firstDataDate: string | null;
  historicalBaseline: HistoricalBaseline | null;
}

function roundMetrics(metrics: Partial<MetricBundle>): MetricBundle {
  return {
    activeUsers: Math.round(metrics.activeUsers || 0),
    newUsers: Math.round(metrics.newUsers || 0),
    sessions: Math.round(metrics.sessions || 0),
    screenPageViews: Math.round(metrics.screenPageViews || 0),
    eventCount: Math.round(metrics.eventCount || 0),
    keyEvents: Math.round(metrics.keyEvents || 0),
    engagementRate: Number(metrics.engagementRate || 0),
    averageSessionDuration: Number(metrics.averageSessionDuration || 0)
  };
}

function percentageChange(value: number, baseline: number): number | null {
  if (!baseline) return value ? null : 0;
  return ((value - baseline) / baseline) * 100;
}

function buildComparison(metrics: MetricBundle, baseline: MetricBundle): Record<keyof MetricBundle, number | null> {
  return {
    activeUsers: percentageChange(metrics.activeUsers, baseline.activeUsers),
    newUsers: percentageChange(metrics.newUsers, baseline.newUsers),
    sessions: percentageChange(metrics.sessions, baseline.sessions),
    screenPageViews: percentageChange(metrics.screenPageViews, baseline.screenPageViews),
    eventCount: percentageChange(metrics.eventCount, baseline.eventCount),
    keyEvents: percentageChange(metrics.keyEvents, baseline.keyEvents),
    engagementRate: percentageChange(metrics.engagementRate, baseline.engagementRate),
    averageSessionDuration: percentageChange(metrics.averageSessionDuration, baseline.averageSessionDuration)
  };
}

export async function fetchRealtime(site: SiteConfig) {
  const [overall, byCountry] = await Promise.all([
    runRealtimeReport(site.propertyId, {
      metrics: [
        { name: "activeUsers" },
        { name: "screenPageViews" },
        { name: "keyEvents" },
        { name: "eventCount" }
      ]
    }),
    runRealtimeReport(site.propertyId, {
      dimensions: [{ name: "country" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 8
    }).catch(() => ({ rows: [], dimensionHeaders: [], metricHeaders: [] }))
  ]);

  const m = overall.rows?.[0]
    ? mapMetricRow(overall.rows[0], overall.metricHeaders || [])
    : { activeUsers: 0, screenPageViews: 0, keyEvents: 0, eventCount: 0 };

  const activeByCountry = (byCountry.rows || []).map((row) => ({
    country: row.dimensionValues?.[0]?.value || "Unknown",
    activeUsers: Math.round(Number(row.metricValues?.[0]?.value || 0))
  }));

  return {
    generatedAt: new Date().toISOString(),
    window: "last 30 minutes",
    metrics: {
      activeUsers: Math.round(m.activeUsers || 0),
      screenPageViews: Math.round(m.screenPageViews || 0),
      keyEvents: Math.round(m.keyEvents || 0),
      eventCount: Math.round(m.eventCount || 0)
    },
    activeByCountry
  };
}

export async function fetchLaunchComparison(site: SiteConfig, today = todayDateOnly()) {
  const windows = buildLaunchWeekWindows({
    launchDate: site.launchDate,
    baselineWeeks: site.baselineWeeks || 4,
    postLaunchWeeks: site.postLaunchWeeks || 8,
    today
  });

  const dateRanges = windows
    .filter((w) => !w.isFuture)
    .map((w) => ({ name: w.id, startDate: w.startDate, endDate: w.endDate }));

  const metricsByRange = new Map<string, MetricBundle>();

  if (dateRanges.length) {
    const batches: { name: string; startDate: string; endDate: string }[][] = [];
    for (let i = 0; i < dateRanges.length; i += 4) {
      batches.push(dateRanges.slice(i, i + 4));
    }
    const responses = await Promise.all(
      batches.map((batch) =>
        runReport(site.propertyId, {
          dateRanges: batch,
          metrics: CORE_METRICS.map((name) => ({ name })),
          keepEmptyRows: true
        })
      )
    );
    responses.forEach((response, batchIndex) => {
      const headers = response.metricHeaders || [];
      const batch = batches[batchIndex];
      (response.rows || []).forEach((row, rowIndex) => {
        const rangeId = row.dimensionValues?.[0]?.value || batch[rowIndex]?.name;
        if (!rangeId) return;
        metricsByRange.set(rangeId, roundMetrics(mapMetricRow(row, headers)));
      });
    });
  }

  const baselineWeeks: (WeekWindow & { metrics: MetricBundle; hasData: boolean })[] = windows.map((w) => {
    const metrics = metricsByRange.get(w.id) || emptyMetrics();
    const hasData = Object.values(metrics).some((v) => v > 0);
    return { ...w, metrics, hasData };
  });

  const baseline = roundMetrics(summarizeBaseline(baselineWeeks));
  const weeks: WeekData[] = baselineWeeks.map((week) => ({
    ...week,
    comparisonToBaseline: buildComparison(week.metrics, baseline)
  }));

  return { launchDate: site.launchDate, baseline, weeks };
}

export async function fetchAcquisition(site: SiteConfig, startDate = "28daysAgo", endDate = "today"): Promise<AcquisitionRow[]> {
  const response = await runReport(site.propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "keyEvents" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 12
  });
  return (response.rows || []).map((row: Ga4Row) => {
    const r = mapDimensionRow(row, response.dimensionHeaders || [], response.metricHeaders || []);
    return {
      channel: r.dimensions.sessionDefaultChannelGroup || "Unassigned",
      sessions: Math.round(r.metrics.sessions || 0),
      activeUsers: Math.round(r.metrics.activeUsers || 0),
      keyEvents: Math.round(r.metrics.keyEvents || 0)
    };
  });
}

export async function fetchPages(site: SiteConfig, startDate = "28daysAgo", endDate = "today"): Promise<PageRow[]> {
  const response = await runReport(site.propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pagePathPlusQueryString" }, { name: "pageTitle" }],
    metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }, { name: "keyEvents" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 12
  });
  return (response.rows || []).map((row: Ga4Row) => {
    const r = mapDimensionRow(row, response.dimensionHeaders || [], response.metricHeaders || []);
    return {
      path: r.dimensions.pagePathPlusQueryString || "/",
      title: r.dimensions.pageTitle || "",
      pageViews: Math.round(r.metrics.screenPageViews || 0),
      activeUsers: Math.round(r.metrics.activeUsers || 0),
      keyEvents: Math.round(r.metrics.keyEvents || 0)
    };
  });
}

export async function fetchCountries(site: SiteConfig, startDate = "28daysAgo", endDate = "today"): Promise<CountryRow[]> {
  const response = await runReport(site.propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "country" }],
    metrics: [{ name: "sessions" }, { name: "activeUsers" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 8
  });
  return (response.rows || []).map((row: Ga4Row) => {
    const r = mapDimensionRow(row, response.dimensionHeaders || [], response.metricHeaders || []);
    return {
      country: r.dimensions.country || "Unknown",
      sessions: Math.round(r.metrics.sessions || 0),
      activeUsers: Math.round(r.metrics.activeUsers || 0)
    };
  });
}

export async function fetchDevices(site: SiteConfig, startDate = "28daysAgo", endDate = "today"): Promise<DeviceRow[]> {
  const response = await runReport(site.propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "deviceCategory" }],
    metrics: [{ name: "sessions" }, { name: "activeUsers" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }]
  });
  return (response.rows || []).map((row: Ga4Row) => {
    const r = mapDimensionRow(row, response.dimensionHeaders || [], response.metricHeaders || []);
    return {
      category: r.dimensions.deviceCategory || "unknown",
      sessions: Math.round(r.metrics.sessions || 0),
      activeUsers: Math.round(r.metrics.activeUsers || 0)
    };
  });
}

export async function fetchDailyTrend(site: SiteConfig, days = 60): Promise<DailyPoint[]> {
  const response = await runReport(site.propertyId, {
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "screenPageViews" },
      { name: "eventCount" },
      { name: "keyEvents" }
    ],
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: 200
  });

  const headers = response.metricHeaders || [];
  return (response.rows || []).map((row: Ga4Row) => {
    const raw = row.dimensionValues?.[0]?.value || "";
    const date = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
    const m = mapMetricRow(row, headers);
    return {
      date,
      sessions: Math.round(m.sessions || 0),
      activeUsers: Math.round(m.activeUsers || 0),
      screenPageViews: Math.round(m.screenPageViews || 0),
      eventCount: Math.round(m.eventCount || 0),
      keyEvents: Math.round(m.keyEvents || 0)
    };
  });
}

export async function fetchTopEvents(site: SiteConfig, startDate = "28daysAgo", endDate = "today"): Promise<EventRow[]> {
  const response = await runReport(site.propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }, { name: "activeUsers" }],
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: 12
  });
  return (response.rows || []).map((row: Ga4Row) => {
    const r = mapDimensionRow(row, response.dimensionHeaders || [], response.metricHeaders || []);
    return {
      name: r.dimensions.eventName || "(unknown)",
      eventCount: Math.round(r.metrics.eventCount || 0),
      activeUsers: Math.round(r.metrics.activeUsers || 0)
    };
  });
}

export async function fetchFirstDataDate(site: SiteConfig): Promise<string | null> {
  const response = await runReport(site.propertyId, {
    dateRanges: [{ startDate: "2020-01-01", endDate: "today" }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: 1
  });
  const raw = response.rows?.[0]?.dimensionValues?.[0]?.value;
  if (!raw) return null;
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
}

export async function fetchSiteDashboard(site: SiteConfig, today = todayDateOnly()): Promise<SiteDashboard> {
  const [comparison, realtime, acquisition, pages, countries, devices, trend, topEvents, firstDataDate] = await Promise.all([
    fetchLaunchComparison(site, today),
    fetchRealtime(site),
    fetchAcquisition(site),
    fetchPages(site),
    fetchCountries(site),
    fetchDevices(site),
    fetchDailyTrend(site),
    fetchTopEvents(site).catch(() => [] as EventRow[]),
    fetchFirstDataDate(site).catch(() => null)
  ]);
  const historicalBaseline = getHistoricalBaseline(site.id);
  return { site, comparison, realtime, acquisition, pages, countries, devices, trend, topEvents, firstDataDate, historicalBaseline };
}
