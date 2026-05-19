"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatNumber } from "@/lib/utils";

export interface CompareSeriesPoint {
  weekFromLaunch: number;
  [siteId: string]: number;
}

interface Props {
  data: CompareSeriesPoint[];
  series: { id: string; name: string; color: string }[];
  metricLabel: string;
}

export function CompareLineChart({ data, series, metricLabel }: Props) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="weekFromLaunch"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => (v === 0 ? "Launch" : v < 0 ? `${v}w` : `+${v}w`)}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatNumber(v)}
          width={48}
        />
        <Tooltip
          cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }}
          formatter={(value: number) => [formatNumber(value), metricLabel]}
          labelFormatter={(label: number) => (label === 0 ? "Launch week" : label < 0 ? `${Math.abs(label)} week(s) before launch` : `${label} week(s) after launch`)}
        />
        <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          iconType="circle"
        />
        {series.map((s) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.name}
            stroke={s.color}
            strokeWidth={2.4}
            dot={{ r: 2.6, strokeWidth: 1.4 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
