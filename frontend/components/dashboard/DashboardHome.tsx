"use client";

import { useEffect, useState, useCallback } from "react";
import { dashboardApi } from "@/lib/api";
import { useSocket } from "@/lib/socket";
import type { DashboardStats } from "@/types";
import HeroStatsBar from "./HeroStatsBar";
import ActiveContactsCard from "./ActiveContactsCard";
import AwaitingRepliesCard from "./AwaitingRepliesCard";
import ToContactCard from "./ToContactCard";
import UpcomingBirthdaysCard from "./UpcomingBirthdaysCard";
import UpcomingImportantDatesCard from "./UpcomingImportantDatesCard";
import RelationshipHealthCard from "./RelationshipHealthCard";
import WeeklyInsightsCard from "./WeeklyInsightsCard";
import DashboardSkeleton from "./DashboardSkeleton";

type TimePeriod = 'today' | '7days' | '30days' | '90days';

export function DashboardHome() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TimePeriod>('today');
  const socket = useSocket();

  const loadDashboardData = useCallback(async () => {
    try {
      setError(null);
      const response = await dashboardApi.getStats();
      setStats(response.data);
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Real-time updates via Socket.io
  useEffect(() => {
    if (!socket) return;

    let debounceTimeout: NodeJS.Timeout;

    const handleNewMessage = () => {
      // Clear existing timeout
      if (debounceTimeout) clearTimeout(debounceTimeout);
      
      // Debounced refresh - wait 2 seconds after last message
      debounceTimeout = setTimeout(() => {
        loadDashboardData();
      }, 2000);
    };

    socket.on("new_message", handleNewMessage);

    return () => {
      socket.off("new_message", handleNewMessage);
      if (debounceTimeout) clearTimeout(debounceTimeout);
    };
  }, [socket, loadDashboardData]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error || !stats) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Dashboard
        </h1>
        <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/30">
          <p className="text-sm text-red-800 dark:text-red-200">
            {error || "Failed to load dashboard data"}
          </p>
          <button
            onClick={loadDashboardData}
            className="mt-2 text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Calculate stats based on active tab
  const getDisplayStats = () => {
    if (!stats) return null;
    
    // For now, we only have "today" stats from backend
    // In the future, we could fetch different time periods
    return stats.today;
  };

  const displayStats = getDisplayStats();

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex items-center justify-between animate-fade-in">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Dashboard
        </h1>
        <button
          onClick={loadDashboardData}
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          title="Refresh dashboard"
        >
          Refresh
        </button>
      </div>

      {/* Section 1: Stats with Tabs */}
      <div className="animate-fade-in" style={{ animationDelay: '50ms' }}>
        <HeroStatsBar 
          stats={displayStats || stats.today} 
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-200 dark:border-zinc-700" />

      {/* Section 2: Activity & Health */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-emerald-500" />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Activity & Health
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
            <ActiveContactsCard data={stats.activeContacts} />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '150ms' }}>
            <RelationshipHealthCard health={stats.relationshipHealth} />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '175ms' }}>
            <WeeklyInsightsCard insights={stats.weeklyInsights} />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-200 dark:border-zinc-700" />

      {/* Section 3: Contact Suggestions */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-blue-500" />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Contact Suggestions
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <AwaitingRepliesCard contacts={stats.awaitingReplies} />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '250ms' }}>
            <ToContactCard contacts={stats.toContact} />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-200 dark:border-zinc-700" />

      {/* Important Dates */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-purple-500" />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Important Dates
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
            <UpcomingBirthdaysCard birthdays={stats.upcomingBirthdays} />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '350ms' }}>
            <UpcomingImportantDatesCard dates={stats.upcomingImportantDates} />
          </div>
        </div>
      </div>
    </div>
  );
}
