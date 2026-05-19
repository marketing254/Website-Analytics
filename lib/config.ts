import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_CONFIG_PATH = path.join("config", "sites.json");

export interface SiteConfig {
  id: string;
  name: string;
  domain?: string;
  propertyId: string;
  launchDate: string;
  baselineWeeks?: number;
  postLaunchWeeks?: number;
  setupMissing?: string[];
}

export interface SitesConfig {
  configPath: string;
  usingExample: boolean;
  timezone: string;
  sites: SiteConfig[];
}

export async function loadSitesConfig(): Promise<SitesConfig> {
  const inlineJson = process.env.SITES_CONFIG_JSON;
  if (inlineJson) {
    const parsed = JSON.parse(inlineJson);
    return {
      configPath: "env:SITES_CONFIG_JSON",
      usingExample: false,
      timezone: parsed.timezone || "Asia/Colombo",
      sites: Array.isArray(parsed.sites) ? parsed.sites : []
    };
  }

  const configPath = process.env.SITES_CONFIG || DEFAULT_CONFIG_PATH;
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch {
    const examplePath = path.join("config", "sites.example.json");
    const example = await readFile(examplePath, "utf8");
    return {
      configPath,
      usingExample: true,
      timezone: "Asia/Colombo",
      sites: JSON.parse(example).sites
    };
  }

  const parsed = JSON.parse(raw);
  return {
    configPath,
    usingExample: false,
    timezone: parsed.timezone || "Asia/Colombo",
    sites: Array.isArray(parsed.sites) ? parsed.sites : []
  };
}

export function validateSite(site: SiteConfig): string[] {
  const missing: string[] = [];
  if (!site.id) missing.push("id");
  if (!site.name) missing.push("name");
  if (!site.propertyId || site.propertyId.includes("REPLACE_WITH")) missing.push("propertyId");
  if (!site.launchDate) missing.push("launchDate");
  return missing;
}
