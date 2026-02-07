import React from 'react';
import { MessageSquare, Send, Inbox, Users } from 'lucide-react';
import type { TodayStats } from '@/types';

interface HeroStatsBarProps {
  stats: TodayStats;
  activeTab: 'today' | '7days' | '30days' | '90days';
  onTabChange: (tab: 'today' | '7days' | '30days' | '90days') => void;
}

export default function HeroStatsBar({ stats, activeTab, onTabChange }: HeroStatsBarProps) {
  const tabs = [
    { id: 'today' as const, label: 'Today' },
    { id: '7days' as const, label: 'Last 7 days' },
    { id: '30days' as const, label: 'Last 30 days' },
    { id: '90days' as const, label: 'Last 90 days' },
  ];

  const statItems = [
    {
      label: 'Messages',
      value: stats.totalMessages,
      icon: MessageSquare,
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Sent',
      value: stats.sent,
      icon: Send,
      color: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Received',
      value: stats.received,
      icon: Inbox,
      color: 'text-purple-600 dark:text-purple-400',
    },
    {
      label: 'Contacts',
      value: stats.uniqueContacts,
      icon: Users,
      color: 'text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {/* Tabs */}
      <div className="mb-6 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Compact Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statItems.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <item.icon className={`h-8 w-8 ${item.color}`} />
            <div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{item.label}</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
