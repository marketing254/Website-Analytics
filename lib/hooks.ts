"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthStatus, DashboardResponse, SiteDashboard, SitesResponse } from "@/lib/types";

export function useDashboardData() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [sites, setSites] = useState<SitesResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [authRes, sitesRes] = await Promise.all([
        fetch("/api/auth/status").then((r) => r.json()),
        fetch("/api/sites").then((r) => r.json())
      ]);
      setAuth(authRes);
      setSites(sitesRes);

      if (authRes.mode === "oauth" && !authRes.connected) {
        setDashboard(null);
        return;
      }

      const dashRes = await fetch("/api/dashboard");
      if (dashRes.status === 401) {
        setAuth({ mode: "oauth", connected: false });
        setDashboard(null);
        return;
      }
      const dashJson = await dashRes.json();
      if (!dashRes.ok) throw new Error(dashJson.error || "Failed to load dashboard");
      setDashboard(dashJson);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const startConnect = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/start");
      const body = await r.json();
      if (!r.ok || !body.authUrl) throw new Error(body.error || "Could not start OAuth");
      window.location.assign(body.authUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start OAuth");
    }
  }, []);

  return { auth, sites, dashboard, loading, error, refresh: fetchAll, startConnect, setAuth };
}

export function useRealtimePolling(siteIds: string[], intervalMs = 30_000) {
  const [realtimeBySite, setRealtimeBySite] = useState<Record<string, SiteDashboard["realtime"]>>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!siteIds.length) return;
    let cancelled = false;

    async function tick() {
      try {
        const results = await Promise.all(
          siteIds.map(async (id) => {
            const r = await fetch(`/api/sites/${id}`);
            if (!r.ok) return null;
            const body = await r.json();
            return { id, realtime: body.dashboard?.realtime as SiteDashboard["realtime"] };
          })
        );
        if (cancelled) return;
        const next: Record<string, SiteDashboard["realtime"]> = {};
        for (const r of results) {
          if (r && r.realtime) next[r.id] = r.realtime;
        }
        setRealtimeBySite(next);
        setUpdatedAt(new Date().toISOString());
      } catch {
        // silent — will retry next tick
      }
    }

    void tick();
    const handle = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [siteIds.join("|"), intervalMs]);

  return { realtimeBySite, updatedAt };
}
