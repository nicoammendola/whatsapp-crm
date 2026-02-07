import React from 'react';
import { TrendingUp } from 'lucide-react';
import DashboardCard from './DashboardCard';
import type { WeeklyInsights } from '@/types';

interface WeeklyInsightsCardProps {
  insights: WeeklyInsights;
}

export default function WeeklyInsightsCard({ insights }: WeeklyInsightsCardProps) {
  return (
    <DashboardCard title="This Week's Activity" icon={<TrendingUp className="h-5 w-5" />}>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Messages
            </p>
            <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {insights.weeklyMessages}
            </p>
          </div>
          <div className="text-4xl">💬</div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              New Contacts
            </p>
            <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {insights.newContacts}
            </p>
          </div>
          <div className="text-4xl">👥</div>
        </div>

        {insights.weeklyMessages > 0 && (
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              {insights.weeklyMessages > 50 ? (
                <>
                  🔥 <strong>High activity!</strong> You've been staying connected this week.
                </>
              ) : insights.weeklyMessages > 20 ? (
                <>
                  ✨ <strong>Good engagement!</strong> Keep building those relationships.
                </>
              ) : (
                <>
                  💪 <strong>Stay active!</strong> Reach out to more contacts this week.
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
