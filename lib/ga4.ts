import { createSign } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DATA_API_BASE = "https://analyticsdata.googleapis.com/v1beta";
const ANALYTICS_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const DEFAULT_TOKEN_PATH = path.join("credentials", "google-token.json");

export class AuthRequiredError extends Error {
  code = "AUTH_REQUIRED" as const;
  constructor(message: string) {
    super(message);
    this.name = "AuthRequiredError";
  }
}

interface OAuthClient {
  clientId: string;
  clientSecret: string;
  tokenUri: string;
  authUri: string;
  redirectUris: string[];
}

interface OAuthToken {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  state?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export function clearTokenCache() {
  cachedToken = null;
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signJwt(header: object, payload: object, privateKey: string): string {
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey);
  return `${unsigned}.${base64Url(signature)}`;
}

async function loadServiceAccount() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set.");
  const raw = await readFile(credentialsPath, "utf8");
  const credentials = JSON.parse(raw);
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("The credentials JSON must include client_email and private_key.");
  }
  return credentials as { client_email: string; private_key: string };
}

function normalizeOAuthClient(raw: any): OAuthClient {
  const client = raw.installed || raw.web || raw;
  if (!client.client_id || !client.client_secret) {
    throw new Error("The OAuth client JSON must include client_id and client_secret.");
  }
  return {
    clientId: client.client_id,
    clientSecret: client.client_secret,
    tokenUri: client.token_uri || TOKEN_URL,
    authUri: client.auth_uri || "https://accounts.google.com/o/oauth2/v2/auth",
    redirectUris: client.redirect_uris || []
  };
}

export async function loadOAuthClient(): Promise<OAuthClient> {
  const inlineJson = process.env.GOOGLE_OAUTH_CLIENT_JSON;
  if (inlineJson) {
    return normalizeOAuthClient(JSON.parse(inlineJson));
  }
  const credentialsPath = process.env.GOOGLE_OAUTH_CLIENT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    throw new Error("Set GOOGLE_OAUTH_CLIENT_JSON or GOOGLE_OAUTH_CLIENT in .env.");
  }
  const raw = JSON.parse(await readFile(credentialsPath, "utf8"));
  return normalizeOAuthClient(raw);
}

function envRefreshToken(): string | undefined {
  return process.env.GOOGLE_REFRESH_TOKEN;
}

export function oauthRedirectUri(client: OAuthClient): string {
  return (
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    client.redirectUris.find((uri) => uri.startsWith("http://localhost")) ||
    "http://localhost:4177/oauth2callback"
  );
}

function tokenPath(): string {
  return process.env.GOOGLE_TOKEN_PATH || DEFAULT_TOKEN_PATH;
}

export async function oauthTokenExists(): Promise<boolean> {
  if (envRefreshToken()) return true;
  try {
    await stat(tokenPath());
    return true;
  } catch {
    return false;
  }
}

async function readOAuthToken(): Promise<OAuthToken> {
  const refresh = envRefreshToken();
  if (refresh) {
    return { refresh_token: refresh };
  }
  try {
    return JSON.parse(await readFile(tokenPath(), "utf8"));
  } catch {
    throw new AuthRequiredError("Google OAuth token is missing. Connect Google Analytics from the dashboard, or set GOOGLE_REFRESH_TOKEN.");
  }
}

async function writeOAuthToken(token: OAuthToken): Promise<void> {
  if (envRefreshToken()) {
    return;
  }
  const filePath = tokenPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(token, null, 2)}\n`);
}

async function refreshOAuthToken(client: OAuthClient, currentToken: OAuthToken): Promise<string> {
  if (!currentToken.refresh_token) {
    throw new AuthRequiredError("Google OAuth refresh token is missing. Reconnect Google Analytics.");
  }

  const response = await fetch(client.tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      refresh_token: currentToken.refresh_token,
      grant_type: "refresh_token"
    })
  });

  const body = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) {
    if (body.error === "invalid_grant") {
      throw new AuthRequiredError("Google refresh token was revoked or expired. Reconnect Google Analytics.");
    }
    throw new Error(body.error_description || body.error || `Unable to refresh Google token (${response.status})`);
  }

  const nextToken: OAuthToken = {
    ...currentToken,
    ...body,
    refresh_token: body.refresh_token || currentToken.refresh_token,
    expires_at: Date.now() + Number(body.expires_in || 3600) * 1000
  };
  await writeOAuthToken(nextToken);
  return nextToken.access_token!;
}

async function fetchOAuthAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const client = await loadOAuthClient();
  const token = await readOAuthToken();
  if (token.access_token && Number(token.expires_at || 0) > Date.now() + 60_000) {
    cachedToken = { token: token.access_token, expiresAt: Number(token.expires_at) };
    return cachedToken.token;
  }
  const accessToken = await refreshOAuthToken(client, token);
  cachedToken = { token: accessToken, expiresAt: Date.now() + 3600 * 1000 };
  return accessToken;
}

async function fetchServiceAccountAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const credentials = await loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: credentials.client_email,
      scope: ANALYTICS_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600
    },
    credentials.private_key
  );

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
  });

  const body = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) {
    throw new Error(body.error_description || body.error || `Unable to fetch access token (${response.status})`);
  }
  cachedToken = {
    token: body.access_token,
    expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000
  };
  return cachedToken.token;
}

async function fetchAccessToken(): Promise<string> {
  if (process.env.GOOGLE_OAUTH_CLIENT) return fetchOAuthAccessToken();
  return fetchServiceAccountAccessToken();
}

export async function exchangeOAuthCode(code: string, state: string): Promise<OAuthToken> {
  const client = await loadOAuthClient();
  const redirectUri = oauthRedirectUri(client);
  const response = await fetch(client.tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  const body = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) {
    throw new Error(body.error_description || body.error || `Unable to exchange Google OAuth code (${response.status})`);
  }

  let previousToken: OAuthToken = {};
  try {
    previousToken = JSON.parse(await readFile(tokenPath(), "utf8"));
  } catch {
    previousToken = {};
  }

  const token: OAuthToken = {
    ...previousToken,
    ...body,
    refresh_token: body.refresh_token || previousToken.refresh_token,
    expires_at: Date.now() + Number(body.expires_in || 3600) * 1000,
    state
  };
  await writeOAuthToken(token);
  return token;
}

export async function buildOAuthAuthorizationUrl(state: string): Promise<{ url: URL; redirectUri: string }> {
  const client = await loadOAuthClient();
  const redirectUri = oauthRedirectUri(client);
  const url = new URL(client.authUri);
  url.searchParams.set("client_id", client.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ANALYTICS_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return { url, redirectUri };
}

export type Ga4Row = {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
};

export type Ga4Header = { name: string };

export interface Ga4Response {
  rows?: Ga4Row[];
  dimensionHeaders?: Ga4Header[];
  metricHeaders?: Ga4Header[];
}

async function callDataApi(p: string, payload: object): Promise<Ga4Response> {
  const token = await fetchAccessToken();
  const response = await fetch(`${DATA_API_BASE}${p}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) {
    throw new Error(body.error?.message || `GA4 request failed (${response.status})`);
  }
  return body;
}

export async function runReport(propertyId: string, payload: object): Promise<Ga4Response> {
  return callDataApi(`/properties/${propertyId}:runReport`, payload);
}

export async function runRealtimeReport(propertyId: string, payload: object): Promise<Ga4Response> {
  return callDataApi(`/properties/${propertyId}:runRealtimeReport`, payload);
}

export function mapMetricRow(row: Ga4Row, headers: Ga4Header[]): Record<string, number> {
  const values = row?.metricValues || [];
  return Object.fromEntries(headers.map((h, i) => [h.name, Number(values[i]?.value || 0)]));
}

export function mapDimensionRow(row: Ga4Row, dimHeaders: Ga4Header[], metricHeaders: Ga4Header[]) {
  const dimensions = Object.fromEntries(dimHeaders.map((h, i) => [h.name, row.dimensionValues?.[i]?.value || ""]));
  return { dimensions, metrics: mapMetricRow(row, metricHeaders) };
}

export function authMode(): "oauth" | "service-account" | "unconfigured" {
  if (process.env.GOOGLE_OAUTH_CLIENT) return "oauth";
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return "service-account";
  return "unconfigured";
}
