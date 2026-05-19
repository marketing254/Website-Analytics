const DAY_MS = 24 * 60 * 60 * 1000;

export interface WeekWindow {
  id: string;
  phase: "Before revamp" | "After revamp";
  weekNumber: number;
  label: string;
  startDate: string;
  endDate: string;
  isFuture?: boolean;
  isPartial?: boolean;
  isComplete: boolean;
}

export interface MetricBundle {
  activeUsers: number;
  newUsers: number;
  sessions: number;
  screenPageViews: number;
  eventCount: number;
  keyEvents: number;
  engagementRate: number;
  averageSessionDuration: number;
}

export function emptyMetrics(): MetricBundle {
  return {
    activeUsers: 0,
    newUsers: 0,
    sessions: 0,
    screenPageViews: 0,
    eventCount: 0,
    keyEvents: 0,
    engagementRate: 0,
    averageSessionDuration: 0
  };
}

export function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) throw new Error(`Expected YYYY-MM-DD date, received "${value}"`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function todayDateOnly(now = new Date()): string {
  return formatDateOnly(now);
}

export function buildLaunchWeekWindows(opts: {
  launchDate: string;
  baselineWeeks?: number;
  postLaunchWeeks?: number;
  today?: string;
}): WeekWindow[] {
  const baselineWeeks = opts.baselineWeeks ?? 4;
  const postLaunchWeeks = opts.postLaunchWeeks ?? 8;
  const today = opts.today ?? todayDateOnly();
  const launch = parseDateOnly(opts.launchDate);
  const todayDate = parseDateOnly(today);
  const windows: WeekWindow[] = [];

  for (let index = baselineWeeks; index >= 1; index -= 1) {
    const start = addDays(launch, index * -7);
    const end = addDays(start, 6);
    windows.push({
      id: `pre-${index}`,
      phase: "Before revamp",
      weekNumber: -index,
      label: `${index}w before`,
      startDate: formatDateOnly(start),
      endDate: formatDateOnly(end),
      isComplete: end <= todayDate
    });
  }

  for (let index = 0; index < postLaunchWeeks; index += 1) {
    const start = addDays(launch, index * 7);
    const plannedEnd = addDays(start, 6);
    if (start > todayDate) {
      windows.push({
        id: `post-${index + 1}`,
        phase: "After revamp",
        weekNumber: index + 1,
        label: `Wk ${index + 1}`,
        startDate: formatDateOnly(start),
        endDate: formatDateOnly(plannedEnd),
        isFuture: true,
        isComplete: false
      });
      continue;
    }
    const end = plannedEnd > todayDate ? todayDate : plannedEnd;
    windows.push({
      id: `post-${index + 1}`,
      phase: "After revamp",
      weekNumber: index + 1,
      label: `Wk ${index + 1}`,
      startDate: formatDateOnly(start),
      endDate: formatDateOnly(end),
      isPartial: plannedEnd > todayDate,
      isComplete: plannedEnd <= todayDate
    });
  }
  return windows;
}

export function averageMetrics(weeks: { metrics: MetricBundle }[]): MetricBundle {
  if (!weeks.length) return emptyMetrics();
  const totals = weeks.reduce<MetricBundle>((sum, week) => {
    sum.activeUsers += week.metrics.activeUsers;
    sum.newUsers += week.metrics.newUsers;
    sum.sessions += week.metrics.sessions;
    sum.screenPageViews += week.metrics.screenPageViews;
    sum.eventCount += week.metrics.eventCount;
    sum.keyEvents += week.metrics.keyEvents;
    sum.engagementRate += week.metrics.engagementRate;
    sum.averageSessionDuration += week.metrics.averageSessionDuration;
    return sum;
  }, emptyMetrics());

  return {
    activeUsers: totals.activeUsers / weeks.length,
    newUsers: totals.newUsers / weeks.length,
    sessions: totals.sessions / weeks.length,
    screenPageViews: totals.screenPageViews / weeks.length,
    eventCount: totals.eventCount / weeks.length,
    keyEvents: totals.keyEvents / weeks.length,
    engagementRate: totals.engagementRate / weeks.length,
    averageSessionDuration: totals.averageSessionDuration / weeks.length
  };
}

export function summarizeBaseline(
  weeks: (WeekWindow & { metrics: MetricBundle; hasData: boolean })[]
): MetricBundle {
  const baseline = weeks.filter((week) => week.phase === "Before revamp" && week.hasData);
  return averageMetrics(baseline);
}
