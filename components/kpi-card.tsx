"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: "blue" | "emerald" | "violet" | "amber" | "rose";
  live?: boolean;
}

const accentMap = {
  blue: "from-blue-500/10 to-blue-500/0 text-blue-600 dark:text-blue-400",
  emerald: "from-emerald-500/10 to-emerald-500/0 text-emerald-600 dark:text-emerald-400",
  violet: "from-violet-500/10 to-violet-500/0 text-violet-600 dark:text-violet-400",
  amber: "from-amber-500/10 to-amber-500/0 text-amber-600 dark:text-amber-400",
  rose: "from-rose-500/10 to-rose-500/0 text-rose-600 dark:text-rose-400"
} as const;

export function KpiCard({ label, value, delta, deltaLabel, hint, icon: Icon, accent = "blue", live }: KpiCardProps) {
  const deltaState = delta === null || delta === undefined ? "neutral" : delta > 0 ? "up" : delta < 0 ? "down" : "neutral";

  return (
    <Card className="relative overflow-hidden">
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b", accentMap[accent])} />
      <CardContent className="relative space-y-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          <div className="flex items-center gap-1.5">
            {live ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                Live
              </span>
            ) : null}
            {Icon ? (
              <div className={cn("grid h-7 w-7 place-items-center rounded-md bg-card", accentMap[accent])}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-baseline gap-2 tabular-nums">
          <strong className="text-3xl font-semibold tracking-tight text-foreground">{value}</strong>
          {delta !== undefined && delta !== null ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                deltaState === "up" && "bg-success/10 text-success",
                deltaState === "down" && "bg-destructive/10 text-destructive",
                deltaState === "neutral" && "bg-muted text-muted-foreground"
              )}
            >
              {deltaState === "up" ? <ArrowUpRight className="h-3 w-3" /> : null}
              {deltaState === "down" ? <ArrowDownRight className="h-3 w-3" /> : null}
              {deltaState === "neutral" ? <ArrowRight className="h-3 w-3" /> : null}
              {Math.abs(delta).toFixed(1)}%
            </span>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">{deltaLabel || hint || "vs baseline"}</p>
      </CardContent>
    </Card>
  );
}
