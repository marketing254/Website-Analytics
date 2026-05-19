// One-off probe to print DL's actual GA4 daily trend.
import { readFile } from "node:fs/promises";

// Load .env manually
const envFile = await readFile(".env", "utf8");
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!m) continue;
  let val = m[2].trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (!process.env[m[1]]) process.env[m[1]] = val;
}

// Now import after env is set
const { fetchDailyTrend } = await import("../lib/analytics.ts").catch(async () => {
  // tsx fallback — use the JSON-only approach via direct fetch
  return { fetchDailyTrend: null };
});

if (fetchDailyTrend) {
  const points = await fetchDailyTrend({ id: "dominate-law", propertyId: "530885750", name: "Dominate Law", launchDate: "2026-04-01" }, 60);
  const launch = "2026-04-01";
  const post = points.filter(p => p.date >= launch);
  console.log("date         sessions  users  views  eventCount  keyEvents");
  post.forEach(p => console.log(
    p.date.padEnd(13),
    String(p.sessions).padStart(8),
    String(p.activeUsers).padStart(6),
    String(p.screenPageViews).padStart(6),
    String(p.eventCount).padStart(11),
    String(p.keyEvents).padStart(10)
  ));
  const totals = post.reduce((s,p) => ({
    sessions: s.sessions+p.sessions, users: s.users+p.activeUsers, views: s.views+p.screenPageViews,
    events: s.events+p.eventCount, keyEvents: s.keyEvents+p.keyEvents
  }), {sessions:0,users:0,views:0,events:0,keyEvents:0});
  console.log("-".repeat(60));
  console.log("TOTAL        ", String(totals.sessions).padStart(8), String(totals.users).padStart(6),
    String(totals.views).padStart(6), String(totals.events).padStart(11), String(totals.keyEvents).padStart(10));
  console.log("days:", post.length);
} else {
  console.log("Could not import lib/analytics.ts directly. Run via dev server instead.");
}
