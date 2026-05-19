import type { SiteDashboard } from "@/lib/analytics";

export interface AuthStatus {
  mode: "oauth" | "service-account" | "unconfigured";
  connected: boolean;
}

export interface SitesResponse {
  configPath: string;
  usingExample: boolean;
  timezone: string;
  authMode: AuthStatus["mode"];
  sites: Array<{
    id: string;
    name: string;
    domain?: string;
    launchDate: string;
    baselineWeeks?: number;
    postLaunchWeeks?: number;
    setupMissing: string[];
    propertyConfigured: boolean;
  }>;
}

export interface DashboardResponse {
  generatedAt: string;
  configPath: string;
  usingExample: boolean;
  skippedSites: Array<{ id: string; name: string; setupMissing: string[] }>;
  dashboards: Array<SiteDashboard | { site: { id: string; name: string }; error: string }>;
}

export type { SiteDashboard };
