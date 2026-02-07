"use client";

import { formatDistanceToNow } from "date-fns";
import type { ContactStats } from "@/types";

interface StatsSectionProps {
  stats: ContactStats | null;
}

export function StatsSection({ stats }: StatsSectionProps) {
  if (!stats) {
    return (
      <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Activity
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading stats...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
        Activity
      </h3>
      <div className="space-y-2">
        {stats.lastInteraction && (
          <StatRow
            label="Last contacted"
            value={formatDistanceToNow(new Date(stats.lastInteraction), { addSuffix: true })}
          />
        )}
        <StatRow
          label="Last 7 days"
          value={`${stats.interactionCount7d} ${stats.interactionCount7d === 1 ? "message" : "messages"}`}
        />
        <StatRow
          label="Last 30 days"
          value={`${stats.interactionCount30d} ${stats.interactionCount30d === 1 ? "message" : "messages"}`}
        />
        <StatRow
          label="Last 90 days"
          value={`${stats.interactionCount90d} ${stats.interactionCount90d === 1 ? "message" : "messages"}`}
        />
        <StatRow
          label="Total messages"
          value={`${stats.totalMessages} (${stats.sentByUser} sent, ${stats.receivedFromContact} received)`}
        />
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start text-xs">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className="font-medium text-zinc-900 dark:text-zinc-100 text-right ml-2">
        {value}
      </span>
    </div>
  );
}
