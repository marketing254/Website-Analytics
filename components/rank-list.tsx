"use client";

import { cn, formatNumber } from "@/lib/utils";

export interface RankItem {
  key: string;
  title: string;
  subtitle?: string;
  value: number;
  metricLabel?: string;
}

interface Props {
  items: RankItem[];
  emptyMessage?: string;
  accent?: string;
}

export function RankList({ items, emptyMessage = "No data yet.", accent = "hsl(var(--chart-1))" }: Props) {
  if (!items.length) {
    return (
      <div className="grid place-items-center rounded-lg border border-dashed bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const pct = (item.value / max) * 100;
        return (
          <li key={item.key} className="group rounded-lg border bg-card p-3 transition-colors hover:border-primary/40">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={item.title}>{item.title}</p>
                {item.subtitle ? <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p> : null}
              </div>
              <div className="text-right tabular-nums">
                <p className="text-sm font-semibold">{formatNumber(item.value)}</p>
                {item.metricLabel ? <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.metricLabel}</p> : null}
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-all")} style={{ width: `${pct}%`, background: accent }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
