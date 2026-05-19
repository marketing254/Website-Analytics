import { NextResponse } from "next/server";
import { loadSitesConfig, validateSite } from "@/lib/config";
import { authMode } from "@/lib/ga4";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await loadSitesConfig();
  return NextResponse.json({
    configPath: config.configPath,
    usingExample: config.usingExample,
    timezone: config.timezone,
    authMode: authMode(),
    sites: config.sites.map((site) => {
      const setupMissing = validateSite(site);
      const { propertyId: _omit, ...rest } = site;
      return {
        ...rest,
        setupMissing,
        propertyConfigured: !setupMissing.includes("propertyId")
      };
    })
  });
}
