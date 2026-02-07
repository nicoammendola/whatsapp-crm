import React from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import DashboardCard from './DashboardCard';
import type { ImportantDate } from '@/types';

interface UpcomingImportantDatesCardProps {
  dates: ImportantDate[];
}

const getContactName = (date: ImportantDate) => {
  return date.name || date.pushName || date.phoneNumber || 'Unknown';
};

const getDaysUntilText = (daysUntil: number) => {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `In ${daysUntil} days`;
};

const getUrgencyStyle = (daysUntil: number) => {
  if (daysUntil === 0) {
    return 'bg-gradient-to-r from-pink-50 to-rose-50 border-pink-300 dark:from-pink-950 dark:to-rose-950 dark:border-pink-700';
  }
  if (daysUntil <= 7) {
    return 'border-red-200 dark:border-red-800';
  }
  if (daysUntil <= 14) {
    return 'border-yellow-200 dark:border-yellow-800';
  }
  return 'border-green-200 dark:border-green-800';
};

export default function UpcomingImportantDatesCard({ dates }: UpcomingImportantDatesCardProps) {
  if (dates.length === 0) {
    return (
      <DashboardCard title="Upcoming Important Dates" icon={<Heart className="h-5 w-5" />}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No upcoming important dates. Add date fields to contact custom fields to track anniversaries and other special dates.
        </p>
      </DashboardCard>
    );
  }

  const displayDates = dates;
  const todayDates = dates.filter(d => d.daysUntil === 0);

  return (
    <DashboardCard
      title="Upcoming Important Dates"
      icon={<Heart className="h-5 w-5" />}
      urgency={todayDates.length > 0 ? 'high' : dates[0]?.urgency || 'low'}
    >
      <div className="space-y-3">
        {displayDates.map((date, index) => (
          <Link
            key={`${date.contactId}-${date.fieldName}-${index}`}
            href={`/dashboard/conversations/${date.contactId}`}
            className={`block rounded-lg border-2 p-3 transition-all hover:shadow-md ${getUrgencyStyle(date.daysUntil)}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {date.daysUntil === 0 && (
                    <span className="text-xl">🎊</span>
                  )}
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {getContactName(date)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {date.fieldLabel}
                  {date.yearsAgo && date.yearsAgo > 0 && (
                    <span className="ml-1">({date.yearsAgo} {date.yearsAgo === 1 ? 'year' : 'years'})</span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-medium ${date.daysUntil === 0 ? 'text-rose-700 dark:text-rose-300' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {getDaysUntilText(date.daysUntil)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}
