"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { ConnectBanner } from "@/components/connect-banner";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "@/lib/hooks";
import { formatRelativeAgo } from "@/lib/utils";
import type { SiteDashboard } from "@/lib/types";

interface Props {
  children: (ctx: { dashboards: SiteDashboard[]; refreshing: boolean }) => React.ReactNode;
  emptyTitle?: string;
}

function ConnectedSearchParamCleanup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justConnected = searchParams?.get("connected") === "1";

  useEffect(() => {
    if (justConnected) {
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      router.replace(url.pathname + (url.search || ""));
    }
  }, [justConnected, router]);

  return null;
}

function isError(d: any): d is { error: string } {
  return d && typeof d.error === "string";
}

export function DashboardShell({ children }: Props) {
  const { auth, dashboard, loading, error, refresh, startConnect } = useDashboardData();
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const dashboards = useMemo(
    () => (dashboard?.dashboards || []).filter((d): d is SiteDashboard => !isError(d)),
    [dashboard]
  );

  const erroredSites = (dashboard?.dashboards || []).filter(isError) as Array<{ site: { name: string }; error: string }>;
  const skippedSites = dashboard?.skippedSites || [];

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <ConnectedSearchParamCleanup />
      </Suspense>
      <AppHeader
        onRefresh={refresh}
        refreshing={loading}
        authMode={auth?.mode}
        connected={auth?.connected}
        onConnect={startConnect}
      />
      <main className="mx-auto w-full max-w-[1480px] space-y-5 px-4 py-6 md:px-8">
        <ConnectBanner auth={auth} onConnect={startConnect} origin={origin} />

        {error ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-5">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : null}

        {(skippedSites.length || erroredSites.length) ? (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="space-y-2 p-5 text-sm">
              <p className="font-semibold text-foreground">Setup notes</p>
              {skippedSites.map((s) => (
                <p key={s.id} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{s.name}</span> is skipped until: {s.setupMissing.join(", ")}.
                </p>
              ))}
              {erroredSites.map((d, i) => (
                <p key={i} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{d.site.name}:</span> {d.error}
                </p>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {loading && !dashboard ? (
          <LoadingSkeleton />
        ) : auth?.mode === "oauth" && !auth?.connected ? (
          <Card>
            <CardContent className="grid place-items-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                Connect Google Analytics above to load your dashboard.
              </p>
            </CardContent>
          </Card>
        ) : !dashboards.length ? (
          <Card>
            <CardContent className="grid place-items-center py-16">
              <p className="text-sm text-muted-foreground">No analytics data yet.</p>
            </CardContent>
          </Card>
        ) : (
          children({ dashboards, refreshing: loading })
        )}

        {dashboard?.generatedAt ? (
          <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            <span>Updated {formatRelativeAgo(dashboard.generatedAt)}</span>
            <span className="opacity-50">·</span>
            <span>GA4 Data API</span>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-60 rounded-xl" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
    </div>
  );
}
