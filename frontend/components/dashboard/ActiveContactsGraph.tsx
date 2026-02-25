"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { ActiveContactsGraphDataPoint } from "@/lib/api";

interface ActiveContactsGraphProps {
  data: ActiveContactsGraphDataPoint[];
  loading?: boolean;
}

export default function ActiveContactsGraph({ data, loading }: ActiveContactsGraphProps) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">No data available</div>
      </div>
    );
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      return format(date, "MMM d");
    } catch {
      return dateString;
    }
  };

  const TOOLTIP_ORDER: { dataKey: keyof ActiveContactsGraphDataPoint; label: string }[] = [
    { dataKey: "daily", label: "Daily" },
    { dataKey: "weekly", label: "Weekly" },
    { dataKey: "monthly", label: "Monthly" },
  ];

  const renderTooltip = (
    props: { active?: boolean; label?: string | number; payload?: readonly unknown[] }
  ) => {
    const { active, label, payload } = props;
    const payloadList = (payload ?? []) as { dataKey?: string; value?: number; color?: string }[];
    if (!active || label == null || label === "" || !payloadList.length) return null;
    const labelStr = typeof label === "number" ? String(label) : label;
    const payloadByKey = Object.fromEntries(
      payloadList.map((p) => [p.dataKey ?? "", p])
    );
    return (
      <div
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
        style={{ zIndex: 1000 }}
      >
        <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {formatDate(labelStr)}
        </p>
        <div className="space-y-1">
          {TOOLTIP_ORDER.map(({ dataKey, label: lineLabel }) => {
            const entry = payloadByKey[dataKey];
            const value = entry?.value ?? 0;
            const color = entry?.color ?? "#71717a";
            return (
              <div key={dataKey} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-zinc-600 dark:text-zinc-400">
                  {lineLabel}: {value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:stroke-zinc-700" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke="#71717a"
          className="dark:stroke-zinc-400"
          style={{ fontSize: "12px" }}
        />
        <YAxis
          stroke="#71717a"
          className="dark:stroke-zinc-400"
          style={{ fontSize: "12px" }}
        />
        <Tooltip
          content={renderTooltip}
          wrapperStyle={{ zIndex: 1000 }}
        />
        <Legend
          wrapperStyle={{ paddingTop: "20px" }}
          iconType="line"
        />
        <Line
          type="monotone"
          dataKey="daily"
          name="Daily"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="weekly"
          name="Weekly"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="monthly"
          name="Monthly"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
