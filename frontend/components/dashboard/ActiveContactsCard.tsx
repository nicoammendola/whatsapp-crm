import React from 'react';
import { Activity } from 'lucide-react';
import DashboardCard from './DashboardCard';
import type { ActiveContactsOverview } from '@/types';

interface ActiveContactsCardProps {
  data: ActiveContactsOverview;
}

export default function ActiveContactsCard({ data }: ActiveContactsCardProps) {
  const periods = [
    { label: 'Today', count: data.today, total: data.total },
    { label: 'Last 7 days', count: data.last7Days, total: data.total },
    { label: 'Last 30 days', count: data.last30Days, total: data.total },
    { label: 'Last 90 days', count: data.last90Days, total: data.total },
  ];

  return (
    <DashboardCard title="Contact Activity" icon={<Activity className="h-5 w-5" />}>
      <div className="space-y-3">
        {periods.map((period) => {
          const percentage = period.total > 0 ? Math.round((period.count / period.total) * 100) : 0;
          
          return (
            <div key={period.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {period.label}
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {period.count} of {period.total} ({percentage}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className="h-full bg-emerald-500 transition-all dark:bg-emerald-400"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
