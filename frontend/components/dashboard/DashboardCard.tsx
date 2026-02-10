import React from 'react';

interface DashboardCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export default function DashboardCard({
  title,
  icon,
  children,
  action,
  className = '',
}: DashboardCardProps) {
  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
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
          className="mt-4 w-full text-center text-sm font-medium text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {action.label} →
        </button>
      )}
    </div>
  );
}
