import { HISTORICAL_BASELINES } from "@/data/historical-baselines";

export interface HistoricalTotals {
  activeUsers: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  eventCount: number;
  keyEvents: number;
}

export interface HistoricalChannel {
  channel: string;
  sessions: number;
}

export interface HistoricalPage {
  title: string;
  pageViews: number;
}

export interface HistoricalEvent {
  name: string;
  eventCount: number;
}

export interface HistoricalCountry {
  country: string;
  activeUsers: number;
}

export interface HistoricalMonth {
  label: string;
  from: string;
  to: string;
  sourceFile: string;
  totals: HistoricalTotals;
  averageEngagementSecondsPerUser: number;
  channels: HistoricalChannel[];
  pages: HistoricalPage[];
  events: HistoricalEvent[];
  countries: HistoricalCountry[];
  dailyActiveUsers: number[];
  dailyNewUsers: number[];
}

export interface HistoricalBaseline {
  siteId: string;
  source: string;
  dateRange: { from: string; to: string };
  monthCount: number;
  totals: HistoricalTotals;
  months: HistoricalMonth[];
}

export function getHistoricalBaseline(siteId: string): HistoricalBaseline | null {
  return HISTORICAL_BASELINES.find((b) => b.siteId === siteId) || null;
}

export function aggregateTopChannels(baseline: HistoricalBaseline): HistoricalChannel[] {
  const map = new Map<string, number>();
  for (const m of baseline.months) {
    for (const c of m.channels) map.set(c.channel, (map.get(c.channel) || 0) + c.sessions);
  }
  return Array.from(map.entries())
    .map(([channel, sessions]) => ({ channel, sessions }))
    .sort((a, b) => b.sessions - a.sessions);
}

export function aggregateTopPages(baseline: HistoricalBaseline, limit = 12): HistoricalPage[] {
  const map = new Map<string, number>();
  for (const m of baseline.months) {
    for (const p of m.pages) map.set(p.title, (map.get(p.title) || 0) + p.pageViews);
  }
  return Array.from(map.entries())
    .map(([title, pageViews]) => ({ title, pageViews }))
    .sort((a, b) => b.pageViews - a.pageViews)
    .slice(0, limit);
}

export function aggregateTopEvents(baseline: HistoricalBaseline): HistoricalEvent[] {
  const map = new Map<string, number>();
  for (const m of baseline.months) {
    for (const e of m.events) map.set(e.name, (map.get(e.name) || 0) + e.eventCount);
  }
  return Array.from(map.entries())
    .map(([name, eventCount]) => ({ name, eventCount }))
    .sort((a, b) => b.eventCount - a.eventCount);
}

export function aggregateTopCountries(baseline: HistoricalBaseline, limit = 8): HistoricalCountry[] {
  const map = new Map<string, number>();
  for (const m of baseline.months) {
    for (const c of m.countries) map.set(c.country, (map.get(c.country) || 0) + c.activeUsers);
  }
  return Array.from(map.entries())
    .map(([country, activeUsers]) => ({ country, activeUsers }))
    .sort((a, b) => b.activeUsers - a.activeUsers)
    .slice(0, limit);
}
