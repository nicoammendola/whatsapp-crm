import React from 'react';
import Link from 'next/link';
import { Cake } from 'lucide-react';
import DashboardCard from './DashboardCard';
import type { UpcomingBirthday } from '@/types';

interface UpcomingBirthdaysCardProps {
  birthdays: UpcomingBirthday[];
}

const getContactName = (birthday: UpcomingBirthday) => {
  return birthday.name || birthday.pushName || birthday.phoneNumber || 'Unknown';
};

const getDaysUntilText = (daysUntil: number) => {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `In ${daysUntil} days`;
};

const getUrgencyStyle = (daysUntil: number) => {
  if (daysUntil === 0) {
    return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 dark:from-yellow-950 dark:to-amber-950 dark:border-yellow-700';
  }
  if (daysUntil <= 7) {
    return 'border-red-200 dark:border-red-800';
  }
  if (daysUntil <= 14) {
    return 'border-yellow-200 dark:border-yellow-800';
  }
  return 'border-green-200 dark:border-green-800';
};

export default function UpcomingBirthdaysCard({ birthdays }: UpcomingBirthdaysCardProps) {
  if (birthdays.length === 0) {
    return (
      <DashboardCard title="Upcoming Birthdays" icon={<Cake className="h-5 w-5" />}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No upcoming birthdays. Add birthday dates to contacts to see them here.
        </p>
      </DashboardCard>
    );
  }

  const displayBirthdays = birthdays;
  const todayBirthdays = birthdays.filter(b => b.daysUntil === 0);

  return (
    <DashboardCard
      title="Upcoming Birthdays"
      icon={<Cake className="h-5 w-5" />}
      urgency={todayBirthdays.length > 0 ? 'high' : birthdays[0]?.urgency || 'low'}
    >
      <div className="space-y-3">
        {displayBirthdays.map((birthday) => (
          <Link
            key={birthday.contactId}
            href={`/dashboard/conversations/${birthday.contactId}`}
            className={`block rounded-lg border-2 p-3 transition-all hover:shadow-md ${getUrgencyStyle(birthday.daysUntil)}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {birthday.daysUntil === 0 && (
                    <span className="text-xl">🎉</span>
                  )}
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {getContactName(birthday)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Turning {birthday.age} years old
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-medium ${birthday.daysUntil === 0 ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {getDaysUntilText(birthday.daysUntil)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}
