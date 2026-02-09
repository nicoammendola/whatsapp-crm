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
import type { MessagesGraphDataPoint } from "@/lib/api";

interface MessagesGraphProps {
  data: MessagesGraphDataPoint[];
  loading?: boolean;
}

export default function MessagesGraph({ data, loading }: MessagesGraphProps) {
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
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e4e4e7",
            borderRadius: "8px",
            padding: "8px 12px",
          }}
          labelFormatter={(value) => formatDate(value as string)}
          formatter={(value: number) => [value, ""]}
          wrapperStyle={{ zIndex: 1000 }}
        />
        <Legend
          wrapperStyle={{ paddingTop: "20px" }}
          iconType="line"
        />
        <Line
          type="monotone"
          dataKey="sent"
          name="Sent"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="received"
          name="Received"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
