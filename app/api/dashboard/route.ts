import { NextResponse } from "next/server";
import { loadSitesConfig, validateSite } from "@/lib/config";
import { fetchSiteDashboard } from "@/lib/analytics";
import { AuthRequiredError, authMode, oauthTokenExists } from "@/lib/ga4";

export const dynamic = "force-dynamic";

export async function GET() {
  if (authMode() === "oauth" && !(await oauthTokenExists())) {
    return NextResponse.json({ error: "AUTH_REQUIRED", message: "Connect Google Analytics to load the dashboard." }, { status: 401 });
  }

  const config = await loadSitesConfig();
  const annotated = config.sites.map((site) => ({ ...site, setupMissing: validateSite(site) }));
  const configured = annotated.filter((s) => !s.setupMissing.length);
  const skipped = annotated.filter((s) => s.setupMissing.length).map((s) => {
    const { propertyId: _omit, ...rest } = s;
    return rest;
  });

  const settled = await Promise.allSettled(configured.map((s) => fetchSiteDashboard(s)));

  const authError = settled.find(
    (r): r is PromiseRejectedResult => r.status === "rejected" && r.reason instanceof AuthRequiredError
  );
  if (authError) {
    return NextResponse.json({ error: "AUTH_REQUIRED", message: (authError.reason as Error).message }, { status: 401 });
  }

  const dashboards = settled.map((r, index) => {
    const site = configured[index];
    if (r.status === "fulfilled") return r.value;
    return { site, error: r.reason instanceof Error ? r.reason.message : "Unable to load analytics" };
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    configPath: config.configPath,
    usingExample: config.usingExample,
    skippedSites: skipped,
    dashboards
  });
}
