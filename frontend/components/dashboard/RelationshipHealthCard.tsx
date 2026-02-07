import React from 'react';
import { Activity } from 'lucide-react';
import DashboardCard from './DashboardCard';
import type { RelationshipHealth } from '@/types';

interface RelationshipHealthCardProps {
  health: RelationshipHealth;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

const getScoreBgColor = (score: number) => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
};

export default function RelationshipHealthCard({ health }: RelationshipHealthCardProps) {
  const scoreColor = getScoreColor(health.score);
  const scoreBgColor = getScoreBgColor(health.score);

  if (health.total === 0) {
    return (
      <DashboardCard title="Relationship Health" icon={<Activity className="h-5 w-5" />}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Set contact frequency targets to track relationship health.
        </p>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Relationship Health" icon={<Activity className="h-5 w-5" />}>
      <div className="space-y-4">
        {/* Overall Score */}
        <div className="text-center">
          <p className={`text-5xl font-bold ${scoreColor}`}>
            {health.score}
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            out of 100
          </p>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className={`h-full ${scoreBgColor} transition-all`}
              style={{ width: `${health.score}%` }}
            />
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-zinc-700 dark:text-zinc-300">On track</span>
            </span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {health.onTrack}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
              <span className="text-zinc-700 dark:text-zinc-300">Need attention</span>
            </span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {health.needsAttention}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-zinc-700 dark:text-zinc-300">At risk</span>
            </span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {health.atRisk}
            </span>
          </div>
        </div>

        {/* Top Suggestion */}
        {health.topSuggestion && (
          <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950">
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
              💡 {health.topSuggestion}
            </p>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
