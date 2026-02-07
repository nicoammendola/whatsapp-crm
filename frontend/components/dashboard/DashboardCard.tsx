import React from 'react';
import type { UrgencyLevel } from '@/types';

interface DashboardCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  urgency?: UrgencyLevel;
  className?: string;
}

export default function DashboardCard({
  title,
  icon,
  children,
  action,
  urgency,
  className = '',
}: DashboardCardProps) {
  const borderColorClass = {
    low: 'border-green-200 dark:border-green-800',
    medium: 'border-yellow-200 dark:border-yellow-800',
    high: 'border-red-200 dark:border-red-800',
  }[urgency || 'low'];

  return (
    <div
      className={`rounded-xl border-2 ${borderColorClass} bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {icon}
          {title}
        </h3>
      </div>

      <div className="space-y-3">{children}</div>

      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 w-full text-center text-sm font-medium text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          {action.label} →
        </button>
      )}
    </div>
  );
}
