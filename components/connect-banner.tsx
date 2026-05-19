"use client";

import { Activity, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AuthStatus } from "@/lib/types";

interface ConnectBannerProps {
  auth: AuthStatus | null;
  onConnect: () => void;
  origin: string;
}

export function ConnectBanner({ auth, onConnect, origin }: ConnectBannerProps) {
  if (!auth) return null;

  if (auth.mode === "oauth" && !auth.connected) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <Activity className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Connect Google Analytics</p>
              <p className="text-sm text-muted-foreground">
                Sign in with the Google account that has Viewer access to both GA4 properties. Token is stored locally and reused on every refresh.
              </p>
              <p className="text-xs text-muted-foreground">
                If Google says <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">redirect_uri_mismatch</code>, add{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{origin}/oauth2callback</code> to your OAuth client's authorized redirect URIs.
              </p>
            </div>
          </div>
          <Button onClick={onConnect} className="shrink-0">
            <Activity className="h-4 w-4" />
            Connect
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (auth.mode === "unconfigured") {
    return (
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="flex items-start gap-3 p-5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Authentication is not configured</p>
            <p className="text-sm text-muted-foreground">
              Set <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">GOOGLE_OAUTH_CLIENT</code> or{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">GOOGLE_APPLICATION_CREDENTIALS</code> in <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env</code>, then restart the server.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
