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

function SkeletonGraphCard() {
  return (
    <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {/* Title */}
      <div className="mb-4 h-6 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
      {/* Graph area */}
      <div className="h-[210px] w-full rounded bg-zinc-100 dark:bg-zinc-800" />
    </div>
  );
}

function SkeletonRelationshipHealthCard() {
  return (
    <div className="animate-pulse rounded-xl border-2 border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {/* Title */}
      <div className="mb-4 flex items-center gap-2">
        <div className="h-5 w-5 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-6 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
      
      {/* Score */}
      <div className="mb-4 text-center">
        <div className="mx-auto mb-2 h-12 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mx-auto mb-3 h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mx-auto h-3 w-full max-w-xs rounded-full bg-zinc-200 dark:bg-zinc-700" />
      </div>

      {/* Status counters */}
      <div className="mb-4 grid grid-cols-2 gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border-2 border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="mb-2 flex items-center justify-center gap-2">
              <div className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
            <div className="h-8 w-12 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        ))}
      </div>

      {/* Contacts list skeleton */}
      <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-5 w-40 rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-3 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
              <div className="h-4 w-4 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Title */}
      <div className="h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />

      {/* Section 1: Graphs with Date Filter */}
      <div className="space-y-4">
        {/* Date Filter skeleton */}
        <div className="flex justify-end">
          <div className="flex items-center gap-3">
            <div className="h-10 w-32 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-10 w-64 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </div>

        {/* Graph Cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonGraphCard />
          <SkeletonGraphCard />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-200 dark:border-zinc-700" />

      {/* Section 2: Relationships Health */}
      <SkeletonRelationshipHealthCard />

      {/* Divider */}
      <div className="border-t border-zinc-200 dark:border-zinc-700" />

      {/* Important Dates - No section title */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
