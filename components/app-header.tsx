"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, BarChart3, GitCompareArrows, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  onRefresh?: () => void;
  refreshing?: boolean;
  authMode?: "oauth" | "service-account" | "unconfigured";
  connected?: boolean;
  onConnect?: () => void;
}

export function AppHeader({ onRefresh, refreshing, authMode, connected, onConnect }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const items = [
    { href: "/", label: "Overview", icon: BarChart3 },
    { href: "/compare", label: "Compare", icon: GitCompareArrows }
  ];

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              GA4 · Launch Analytics
            </span>
            <span className="text-sm font-semibold tracking-tight">Website Revamp Performance</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 rounded-lg bg-muted p-1 md:flex">
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:flex">
            <span
              className={cn(
                "relative flex h-2 w-2 rounded-full",
                connected ? "bg-success" : "bg-muted-foreground/40"
              )}
            >
              {connected ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              ) : null}
            </span>
            <span className="font-medium">
              {authMode === "service-account" ? "Service account" : connected ? "Live" : "Disconnected"}
            </span>
          </div>

          {authMode === "oauth" ? (
            <Button
              variant={connected ? "outline" : "default"}
              size="sm"
              onClick={onConnect}
              className="gap-1.5"
            >
              <Activity className="h-3.5 w-3.5" />
              {connected ? "Reconnect" : "Connect Google Analytics"}
            </Button>
          ) : null}

          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} className="gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <nav className="flex md:hidden border-t bg-background/95">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium",
                active ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
