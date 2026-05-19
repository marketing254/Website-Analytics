import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "DASHBOARD_PASSWORD is not set on the server." }, { status: 500 });
  }

  let body: { password?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const submitted = (body.password || "").trim();
  if (submitted.length === 0) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  if (!constantTimeEqual(submitted, expected)) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  let token: string;
  try {
    token = await signSession({
      sub: "dashboard",
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not sign session" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
  return res;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
