"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import DashboardCard from './DashboardCard';
import { dashboardApi } from '@/lib/api';
import type { ImportantDate } from '@/types';

interface UpcomingImportantDatesCardProps {
  dates: ImportantDate[];
}

const PAGE_SIZE = 5;

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

export default function UpcomingImportantDatesCard({ dates: initialDates }: UpcomingImportantDatesCardProps) {
  const [dates, setDates] = useState<ImportantDate[]>(initialDates);
  const [currentPage, setCurrentPage] = useState(0);
  const [total, setTotal] = useState(initialDates.length);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDates(0);
  }, []);

  const loadDates = async (page: number) => {
    setLoading(true);
    try {
      const offset = page * PAGE_SIZE;
      const response = await dashboardApi.getUpcomingImportantDates(PAGE_SIZE, offset);
      setDates(response.data.dates);
      setTotal(response.data.total);
      setHasMore(response.data.hasMore);
    } catch (error) {
      console.error("Failed to load important dates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 0) {
      setCurrentPage(newPage);
      loadDates(newPage);
    }
  };

  if (dates.length === 0 && !loading) {
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
      {loading ? (
        <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Loading...
        </div>
      ) : (
        <>
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

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0 || loading}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Page {currentPage + 1} of {Math.ceil(total / PAGE_SIZE)}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!hasMore || loading}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </DashboardCard>
  );
}
