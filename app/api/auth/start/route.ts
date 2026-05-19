import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authMode, buildOAuthAuthorizationUrl } from "@/lib/ga4";
import { rememberOauthState } from "@/lib/oauth-state";

export const dynamic = "force-dynamic";

export async function GET() {
  if (authMode() !== "oauth") {
    return NextResponse.json({ error: "OAuth is not configured. Set GOOGLE_OAUTH_CLIENT in .env." }, { status: 400 });
  }
  try {
    const state = randomBytes(18).toString("hex");
    const { url, redirectUri } = await buildOAuthAuthorizationUrl(state);
    rememberOauthState(state);
    return NextResponse.json({ authUrl: url.toString(), redirectUri });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start OAuth" }, { status: 500 });
  }
}
