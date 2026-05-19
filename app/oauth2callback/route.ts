import { NextResponse } from "next/server";
import { clearTokenCache, exchangeOAuthCode } from "@/lib/ga4";
import { consumeOauthState } from "@/lib/oauth-state";

export const dynamic = "force-dynamic";

function errorPage(title: string, message: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font:14px/1.5 system-ui;margin:48px auto;max-width:560px;padding:0 16px;color:#0f172a}
h1{font-size:1.3rem;margin:0 0 12px}.box{border:1px solid #fcd34d;background:#fffbeb;color:#7c4a03;padding:14px;border-radius:8px}
a{color:#2563eb}</style></head>
<body><h1>${title}</h1><div class="box">${message}</div><p><a href="/">Back to dashboard</a></p></body></html>`,
    { status: 400, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) return errorPage("Google returned an error", error);
  if (!code || !state || !consumeOauthState(state)) {
    return errorPage("Invalid OAuth response", "Missing or expired state. Try connecting again.");
  }

  try {
    await exchangeOAuthCode(code, state);
    clearTokenCache();
    return NextResponse.redirect(new URL("/?connected=1", request.url));
  } catch (e) {
    return errorPage("Could not finish Google connection", e instanceof Error ? e.message : "Unknown error");
  }
}
