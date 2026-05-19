"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatNumber } from "@/lib/utils";

export interface TrendPoint {
  date: string;
  sessions: number;
  activeUsers: number;
  screenPageViews: number;
  eventCount: number;
  keyEvents: number;
}

interface Props {
  data: TrendPoint[];
  launchDate?: string;
  metric?: "sessions" | "activeUsers" | "screenPageViews" | "eventCount" | "keyEvents";
}

const labelMap: Record<string, string> = {
  sessions: "Sessions",
  activeUsers: "Users",
  screenPageViews: "Page views",
  eventCount: "Events",
  keyEvents: "Key events"
};

export function DailyTrendChart({ data, launchDate, metric = "sessions" }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.32} />
            <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="hsl(var(--muted-foreground))"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: string) => {
            if (!value || value.length < 10) return value;
            const d = new Date(`${value}T00:00:00Z`);
            return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
          }}
          minTickGap={28}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatNumber(v)}
          width={42}
        />
        <Tooltip
          cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }}
          formatter={(value: number) => [formatNumber(value), labelMap[metric] || metric]}
          labelFormatter={(label: string) => {
            if (!label || label.length < 10) return label;
            const d = new Date(`${label}T00:00:00Z`);
            return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
          }}
        />
        {launchDate ? (
          <ReferenceLine
            x={launchDate}
            stroke="hsl(var(--success))"
            strokeWidth={2}
            strokeDasharray="4 3"
            label={{
              value: "Launch",
              position: "top",
              fill: "hsl(var(--success))",
              fontSize: 10,
              fontWeight: 700
            }}
          />
        ) : null}
        <Area
          type="monotone"
          dataKey={metric}
          stroke="hsl(var(--chart-1))"
          strokeWidth={2.2}
          fill="url(#trendFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
