"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatNumber } from "@/lib/utils";

export interface WeeklyDatum {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  phase: "Before revamp" | "After revamp";
  isPartial?: boolean;
  isFuture?: boolean;
  sessions: number;
  users: number;
  views: number;
  events: number;
  keyEvents: number;
}

interface Props {
  data: WeeklyDatum[];
  baseline: number;
  metric?: "sessions" | "users" | "views" | "events" | "keyEvents";
}

const colorBefore = "#94a3b8";
const colorAfter = "#2563eb";
const colorPartial = "#60a5fa";

export function WeeklyBarChart({ data, baseline, metric = "sessions" }: Props) {
  const filtered = data.filter((d) => !d.isFuture);
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={filtered} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v)} width={48} />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          formatter={(value: number) => [formatNumber(value), metric]}
          labelFormatter={(label, items) => {
            const datum = items?.[0]?.payload as WeeklyDatum | undefined;
            if (!datum) return label;
            return `${datum.label} · ${datum.startDate} → ${datum.endDate}${datum.isPartial ? " (partial)" : ""}`;
          }}
        />
        {baseline > 0 ? (
          <ReferenceLine
            y={baseline}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
            label={{
              value: `Baseline ${formatNumber(baseline)}`,
              position: "right",
              fill: "hsl(var(--muted-foreground))",
              fontSize: 10,
              fontWeight: 600
            }}
          />
        ) : null}
        <Bar dataKey={metric} radius={[6, 6, 0, 0]}>
          {filtered.map((d) => (
            <Cell key={d.id} fill={d.phase === "After revamp" ? (d.isPartial ? colorPartial : colorAfter) : colorBefore} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
