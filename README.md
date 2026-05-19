# GA4 Launch Analytics Dashboard

A password-protected Next.js 15 dashboard for tracking website launch performance via the Google Analytics Data API v1.

Configured for:

- **Reduce Insurance Dependency** (relaunched 2026-04-30)
- **Dominate Law** (relaunched 2026-04-01)

## Features

- **Sign-in gate** — password + signed cookie session, all routes protected by Edge middleware
- **Overview** — combined live activity and per-site cards across all configured sites
- **Site detail** — realtime tile, weekly bar chart with baseline reference, daily trend area chart, audience donuts (countries, devices), top events, channels, pages, full weekly breakdown
- **Compare** — time-aligned line chart (week 0 = launch day), side-by-side metric tables
- **Launch-date sanity check** — surfaces a warning if GA4's earliest data is later than the configured launch date
- **Realtime + 5 historical metrics** — sessions, users, page views, **events**, key events (all backed by [GA4 Data API v1](https://developers.google.com/analytics/devguides/reporting/data/v1) and [Realtime API](https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-basics))

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind · shadcn/ui primitives · Recharts · lucide-react · native fetch-based GA4 client (no Google SDK).

---

# Local development

## 1. Configure Google Cloud

In [Google Cloud Console](https://console.cloud.google.com):

- **APIs & Services → Credentials** → open your OAuth 2.0 **Web** client → add authorized redirect URI:
  ```
  http://localhost:4177/oauth2callback
  ```
- **APIs & Services → Library** → enable **Google Analytics Data API**.
- The Google account you sign in with must have **Viewer** access on each GA4 property listed in [config/sites.json](config/sites.json).

## 2. Configure the dashboard

```powershell
npm install
cp .env.example .env
```

Edit `.env`:

```env
DASHBOARD_PASSWORD=<pick something strong>
SESSION_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
GOOGLE_OAUTH_CLIENT=credentials/client_secret_xxx.apps.googleusercontent.com.json
GOOGLE_TOKEN_PATH=credentials/google-token.json
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:4177/oauth2callback
SITES_CONFIG=config/sites.json
```

Drop the OAuth client JSON into `credentials/`.

## 3. Run

```powershell
npm run dev
```

Open http://localhost:4177 → sign in with your `DASHBOARD_PASSWORD` → click **Connect Google Analytics** → finish the OAuth flow → dashboard populates. The Google token is saved to `credentials/google-token.json` and reused on every refresh.

---

# Deploying to Vercel via GitHub

You'll do this once. After that every `git push` redeploys.

## A. Get a refresh token (one-time, locally)

Vercel's filesystem is read-only, so we can't run the OAuth callback there. Run it once locally to get a permanent refresh token, then paste that into Vercel.

1. `npm run dev`, sign in, click **Connect Google Analytics**, finish the flow.
2. Open `credentials/google-token.json`. Copy the value of `refresh_token` (starts with `1//0g...`). Keep it private.

## B. Push the code to GitHub

The repo has a `.gitignore` that excludes `.env`, `credentials/`, and `config/sites.json`. Verify before committing:

```powershell
git init
git add .
git status   # confirm no .env, credentials/, or sites.json files are staged
git commit -m "GA4 launch analytics dashboard"
```

Create a **private** GitHub repo (`gh repo create launch-analytics --private --source=. --remote=origin --push` if you have the GitHub CLI, otherwise the GitHub web UI), and push.

## C. Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new), pick the GitHub repo. Vercel auto-detects Next.js — accept defaults.
2. **Don't deploy yet** — add environment variables first, in **Project Settings → Environment Variables**:

   | Name | Value |
   |---|---|
   | `DASHBOARD_PASSWORD` | A strong password you'll use to sign in |
   | `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` output (32+ chars) |
   | `GOOGLE_OAUTH_CLIENT_JSON` | The **entire contents** of `credentials/client_secret_xxx.apps.googleusercontent.com.json` (one line, valid JSON) |
   | `GOOGLE_REFRESH_TOKEN` | The `refresh_token` you copied in step A |
   | `GOOGLE_OAUTH_REDIRECT_URI` | `https://<your-project-name>.vercel.app/oauth2callback` |
   | `SITES_CONFIG_JSON` | The **entire contents** of `config/sites.json` (one line, valid JSON) |

   Set each for **Production**, **Preview**, and **Development** environments.

3. Hit **Deploy**. After the first build, Vercel will give you a URL like `https://launch-analytics-xyz.vercel.app`.

## D. Update Google Cloud with the production redirect URI

Back in **Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs**, add:

```
https://<your-project-name>.vercel.app/oauth2callback
```

(Keep the `localhost:4177` one for local dev.)

Save.

## E. (Optional) OAuth consent screen

If you see a Google warning that the app "isn't verified," go to **APIs & Services → OAuth consent screen** and add your email under **Test users**. The app stays in "Testing" mode and works fine for personal/internal use; verification is only needed for public apps with many users.

## F. Custom domain (optional)

**Vercel → Project → Settings → Domains** → add your domain → follow Vercel's CNAME instructions. Then add the new `https://yourdomain.com/oauth2callback` to Google Cloud and update `GOOGLE_OAUTH_REDIRECT_URI` in Vercel env vars.

## G. Done

Visit the URL → sign in with `DASHBOARD_PASSWORD` → dashboard loads with live data.

Every `git push origin main` triggers a redeploy.

---

# Routing & API surface

| Route | Purpose | Public? |
|---|---|---|
| `/login` | Sign-in form | Public |
| `POST /api/auth/login` | Set session cookie | Public |
| `POST /api/auth/logout` | Clear session cookie | Authenticated |
| `/oauth2callback` | Google OAuth landing | Public |
| `/` | Overview | Authenticated |
| `/sites/[id]` | Per-site detail | Authenticated |
| `/compare` | Cross-site compare | Authenticated |
| `GET /api/auth/status` | Token presence | Authenticated |
| `GET /api/auth/start` | Returns Google auth URL | Authenticated |
| `GET /api/sites` | Site list | Authenticated |
| `GET /api/sites/[id]` | Per-site dashboard data | Authenticated |
| `GET /api/dashboard` | All sites combined | Authenticated |

`middleware.ts` redirects unauthenticated browser requests to `/login?next=…` and responds with `401 UNAUTHENTICATED` for unauthenticated `/api/*` requests.

# Project layout

```
app/
  layout.tsx
  page.tsx                         /          — Overview
  compare/page.tsx                 /compare   — Compare view
  sites/[siteId]/page.tsx          /sites/:id — Per-site detail
  login/page.tsx                   /login     — Sign-in
  oauth2callback/route.ts          OAuth callback
  api/
    auth/login/route.ts            POST password → session cookie
    auth/logout/route.ts           POST clear cookie
    auth/status/route.ts           GA4 OAuth token presence
    auth/start/route.ts            Returns Google auth URL
    sites/route.ts
    sites/[siteId]/route.ts
    dashboard/route.ts
middleware.ts                      Edge-runtime route gating
components/
  ui/                              shadcn primitives
  charts/                          Recharts wrappers
  app-header.tsx, dashboard-shell.tsx, ...
lib/
  ga4.ts                           OAuth + Data API client
  analytics.ts                     Higher-level GA4 queries
  dates.ts                         Launch-relative week math
  config.ts                        sites.json / SITES_CONFIG_JSON loader
  session.ts                       HMAC cookie sign/verify (Web Crypto)
  hooks.ts                         useDashboardData, useRealtimePolling
  types.ts                         Shared types
  utils.ts                         cn(), formatters
config/
  sites.json                       Per-site GA4 properties + launch dates
credentials/                       OAuth client + saved token (gitignored)
```

# Common errors

| Error | Fix |
|---|---|
| `redirect_uri_mismatch` from Google | Add the matching `…/oauth2callback` to the OAuth client's authorized redirect URIs in Google Cloud Console. |
| `User does not have sufficient permissions` | Add the signed-in account as Viewer on each GA4 property. |
| `Google Analytics Data API has not been used in project ...` | Enable the Data API in Google Cloud Console. |
| `invalid_grant` / refresh token expired | Click **Reconnect** in the dashboard header (locally), then update `GOOGLE_REFRESH_TOKEN` in Vercel env vars. |
| `SESSION_SECRET is not set or is too short` | Set `SESSION_SECRET` to a 32+ character random string. |
| `Configured launch date may be wrong` warning | The configured `launchDate` predates GA4's first data. Update `config/sites.json` (locally) or `SITES_CONFIG_JSON` (Vercel). |
| Port 4177 already in use | `Get-NetTCPConnection -LocalPort 4177 -State Listen \| ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }` |

# References

- [GA4 Data API v1 overview](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Realtime API basics](https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-basics)
- [Realtime API schema](https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-api-schema)
