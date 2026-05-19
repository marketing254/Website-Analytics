import { NextResponse } from "next/server";
import { loadSitesConfig, validateSite } from "@/lib/config";
import { fetchSiteDashboard } from "@/lib/analytics";
import { AuthRequiredError, authMode, oauthTokenExists } from "@/lib/ga4";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await ctx.params;

  if (authMode() === "oauth" && !(await oauthTokenExists())) {
    return NextResponse.json({ error: "AUTH_REQUIRED", message: "Connect Google Analytics to load the dashboard." }, { status: 401 });
  }

  const config = await loadSitesConfig();
  const site = config.sites.find((s) => s.id === siteId);
  if (!site) return NextResponse.json({ error: "Unknown site" }, { status: 404 });

  const setupMissing = validateSite(site);
  if (setupMissing.length) {
    return NextResponse.json({ error: "SETUP_INCOMPLETE", setupMissing }, { status: 422 });
  }

  try {
    const dashboard = await fetchSiteDashboard(site);
    return NextResponse.json({ generatedAt: new Date().toISOString(), dashboard });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "AUTH_REQUIRED", message: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load analytics" }, { status: 500 });
  }
}
