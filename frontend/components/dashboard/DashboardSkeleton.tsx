import React from 'react';

function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl border-2 border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
    >
      {/* Title */}
      <div className="mb-4 h-6 w-1/2 rounded bg-zinc-200 dark:bg-zinc-700" />
      
      {/* Content lines */}
      <div className="space-y-3">
        <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-5/6 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Title */}
      <div className="h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />

      {/* Compact Stats with Tabs */}
      <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        {/* Tabs skeleton */}
        <div className="mb-6 flex gap-2 border-b border-zinc-200 dark:border-zinc-700">
          <div className="h-8 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-8 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-8 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-8 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-6 w-12 rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-200 dark:border-zinc-700" />

      {/* Section 2: Activity & Health */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <div className="h-6 w-40 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-200 dark:border-zinc-700" />

      {/* Section 3: Contact Suggestions */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <div className="h-6 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-200 dark:border-zinc-700" />

      {/* Section 4: Important Dates */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <div className="h-6 w-40 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}
