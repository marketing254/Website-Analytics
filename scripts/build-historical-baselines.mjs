#!/usr/bin/env node
// Parses GA4 "Reports snapshot" CSVs in the repo root and emits
// data/historical-baselines.ts with hardcoded values.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const FILES = [
  { siteId: "reduce-insurance-dependency", file: "rid Jan.csv" },
  { siteId: "reduce-insurance-dependency", file: "rid feb.csv" },
  { siteId: "reduce-insurance-dependency", file: "rid march.csv" },
  { siteId: "reduce-insurance-dependency", file: "rid april.csv" },
  { siteId: "dominate-law", file: "DL Jan.csv" },
  { siteId: "dominate-law", file: "DL feb.csv" },
  { siteId: "dominate-law", file: "DL march.csv" }
];

const OUTPUT = path.join("data", "historical-baselines.ts");

function parseCsvRow(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseSnapshot(content) {
  const lines = content.split(/\r?\n/);
  const sections = [];
  let i = 0;
  let lastTitle = null;

  while (i < lines.length) {
    // Read leading comment block, capturing the most recent non-boilerplate "# ..." line as the title.
    while (i < lines.length && !lines[i].startsWith("# Start date:")) {
      const line = lines[i];
      if (line.startsWith("# ") && line.trim() !== "#") {
        const stripped = line.slice(2).trim();
        if (
          !stripped.startsWith("Reports snapshot") &&
          !stripped.startsWith("Account:") &&
          !stripped.startsWith("Property:") &&
          !stripped.startsWith("---") &&
          !stripped.startsWith("Start date:") &&
          !stripped.startsWith("End date:")
        ) {
          lastTitle = stripped;
        }
      }
      i += 1;
    }
    if (i >= lines.length) break;

    const startMatch = lines[i].match(/# Start date: (\d{8})/);
    const startDate = startMatch ? startMatch[1] : null;
    i += 1;
    if (i >= lines.length) break;
    const endMatch = lines[i].match(/# End date: (\d{8})/);
    const endDate = endMatch ? endMatch[1] : null;
    i += 1;
    if (i >= lines.length) break;

    // header
    const header = parseCsvRow(lines[i]);
    i += 1;

    // rows until blank line
    const rows = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#")) {
      rows.push(parseCsvRow(lines[i]));
      i += 1;
    }

    sections.push({ title: lastTitle, startDate, endDate, header, rows });
  }

  return sections;
}

function summarizeMonth(siteId, filename, sections) {
  const findHeader = (cols) =>
    sections.find((s) => s.header.length >= cols.length && cols.every((c, idx) => s.header[idx] === c));

  const period = sections[0] ? { from: sections[0].startDate, to: sections[0].endDate } : { from: "", to: "" };

  const activeUsersDaily = findHeader(["Nth day", "Active users"]);
  const newUsersDaily = findHeader(["Nth day", "New users"]);
  const engagementDaily = findHeader(["Nth day", "Average engagement time per active user"]);
  const channels = findHeader(["Session primary channel group (Default channel group)", "Sessions"]);
  const newUsersChannel = findHeader(["First user primary channel group (Default channel group)", "New users"]);
  const countries = findHeader(["Country", "Active users"]);
  const pages = findHeader(["Page title and screen class", "Views"]);
  const events = findHeader(["Event name", "Event count"]);
  const keyEventsSec = findHeader(["Event name", "Key events"]);

  const sumCol = (sec, idx) =>
    sec ? sec.rows.reduce((sum, r) => sum + Number(r[idx] || 0), 0) : 0;

  const totalActiveUsers = sumCol(activeUsersDaily, 1);
  const totalNewUsers = sumCol(newUsersDaily, 1);
  const totalSessions = sumCol(channels, 1);
  const totalPageViews = sumCol(pages, 1);
  const totalEventCount = sumCol(events, 1);
  const totalKeyEvents = sumCol(keyEventsSec, 1);

  let avgEngagementTimePerUser = 0;
  if (engagementDaily && engagementDaily.rows.length) {
    const vals = engagementDaily.rows
      .map((r) => Number(r[1] || 0))
      .filter((n) => Number.isFinite(n));
    if (vals.length) avgEngagementTimePerUser = vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  return {
    siteId,
    filename,
    period,
    totals: {
      activeUsers: totalActiveUsers,
      newUsers: totalNewUsers,
      sessions: totalSessions,
      pageViews: totalPageViews,
      eventCount: totalEventCount,
      keyEvents: totalKeyEvents
    },
    averageEngagementSecondsPerUser: avgEngagementTimePerUser,
    channels: (channels?.rows || []).map((r) => ({
      channel: r[0],
      sessions: Number(r[1] || 0)
    })),
    pages: (pages?.rows || []).slice(0, 20).map((r) => ({
      title: r[0],
      pageViews: Number(r[1] || 0)
    })),
    events: (events?.rows || []).map((r) => ({
      name: r[0],
      eventCount: Number(r[1] || 0)
    })),
    countries: (countries?.rows || []).map((r) => ({
      country: r[0],
      activeUsers: Number(r[1] || 0)
    })),
    dailyActiveUsers: (activeUsersDaily?.rows || []).map((r) => Number(r[1] || 0)),
    dailyNewUsers: (newUsersDaily?.rows || []).map((r) => Number(r[1] || 0))
  };
}

function isoFromDate(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function monthLabel(yyyymmdd) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(yyyymmdd.slice(4, 6)) - 1]} ${yyyymmdd.slice(0, 4)}`;
}

async function main() {
  const months = [];
  for (const { siteId, file } of FILES) {
    const content = await readFile(file, "utf8");
    const sections = parseSnapshot(content);
    months.push(summarizeMonth(siteId, file, sections));
  }

  // Group by site
  const bySite = new Map();
  for (const m of months) {
    if (!bySite.has(m.siteId)) bySite.set(m.siteId, []);
    bySite.get(m.siteId).push(m);
  }

  // Build output
  const baselines = [];
  for (const [siteId, siteMonths] of bySite) {
    siteMonths.sort((a, b) => a.period.from.localeCompare(b.period.from));

    const monthsOut = siteMonths.map((m) => ({
      label: monthLabel(m.period.from),
      from: isoFromDate(m.period.from),
      to: isoFromDate(m.period.to),
      sourceFile: m.filename,
      totals: m.totals,
      averageEngagementSecondsPerUser: Number(m.averageEngagementTimePerUser?.toFixed(2) || m.averageEngagementSecondsPerUser?.toFixed(2) || 0),
      channels: m.channels,
      pages: m.pages,
      events: m.events,
      countries: m.countries,
      dailyActiveUsers: m.dailyActiveUsers,
      dailyNewUsers: m.dailyNewUsers
    }));

    const aggregate = monthsOut.reduce(
      (sum, m) => {
        sum.activeUsers += m.totals.activeUsers;
        sum.newUsers += m.totals.newUsers;
        sum.sessions += m.totals.sessions;
        sum.pageViews += m.totals.pageViews;
        sum.eventCount += m.totals.eventCount;
        sum.keyEvents += m.totals.keyEvents;
        return sum;
      },
      { activeUsers: 0, newUsers: 0, sessions: 0, pageViews: 0, eventCount: 0, keyEvents: 0 }
    );

    const dateRange = {
      from: monthsOut[0]?.from || "",
      to: monthsOut[monthsOut.length - 1]?.to || ""
    };

    baselines.push({
      siteId,
      source: "Old Google Analytics property (pre-revamp)",
      dateRange,
      monthCount: monthsOut.length,
      totals: aggregate,
      months: monthsOut
    });
  }

  const ts = `// AUTO-GENERATED by scripts/build-historical-baselines.mjs
// Source: pre-revamp GA4 "Reports snapshot" CSVs (data is static — old G-id is no longer collecting).
// Re-run: \`node scripts/build-historical-baselines.mjs\`

import type { HistoricalBaseline } from "@/lib/historical";

export const HISTORICAL_BASELINES: HistoricalBaseline[] = ${JSON.stringify(baselines, null, 2)};
`;

  await writeFile(OUTPUT, ts);
  console.log(`wrote ${OUTPUT}`);
  for (const b of baselines) {
    console.log(
      `  ${b.siteId.padEnd(30)} ${b.dateRange.from} → ${b.dateRange.to} · ${b.monthCount} mo · ` +
        `${b.totals.sessions} sessions · ${b.totals.activeUsers} users · ${b.totals.pageViews} views · ${b.totals.eventCount} events`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
