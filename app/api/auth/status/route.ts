import { NextResponse } from "next/server";
import { authMode, oauthTokenExists } from "@/lib/ga4";

export const dynamic = "force-dynamic";

export async function GET() {
  const mode = authMode();
  if (mode === "oauth") {
    return NextResponse.json({ mode, connected: await oauthTokenExists() });
  }
  if (mode === "service-account") {
    return NextResponse.json({ mode, connected: true });
  }
  return NextResponse.json({ mode, connected: false });
}
