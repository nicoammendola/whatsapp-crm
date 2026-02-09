"use client";

import { useEffect, useState, useCallback } from "react";
import { dashboardApi, type MessagesGraphDataPoint, type ActiveContactsGraphDataPoint } from "@/lib/api";
import { useSocket } from "@/lib/socket";
import { subDays, startOfToday, startOfDay, endOfDay } from "date-fns";
import type { DashboardStats } from "@/types";
import DateFilter from "./DateFilter";
import MessagesGraph from "./MessagesGraph";
import ActiveContactsGraph from "./ActiveContactsGraph";
import UpcomingBirthdaysCard from "./UpcomingBirthdaysCard";
import UpcomingImportantDatesCard from "./UpcomingImportantDatesCard";
import RelationshipHealthCard from "./RelationshipHealthCard";
import DashboardSkeleton from "./DashboardSkeleton";

export function DashboardHome() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socket = useSocket();

  // Date filter state - default to last 7 days
  const [fromDate, setFromDate] = useState<Date>(startOfDay(subDays(startOfToday(), 6)));
  const [toDate, setToDate] = useState<Date>(endOfDay(startOfToday()));
  const [oldestDate, setOldestDate] = useState<Date | null>(null);

  // Graph data state
  const [messagesGraphData, setMessagesGraphData] = useState<MessagesGraphDataPoint[]>([]);
  const [activeContactsGraphData, setActiveContactsGraphData] = useState<ActiveContactsGraphDataPoint[]>([]);
  const [graphLoading, setGraphLoading] = useState(false);

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

  // Load oldest message date on mount
  useEffect(() => {
    const loadOldestDate = async () => {
      try {
        const response = await dashboardApi.getOldestMessageDate();
        if (response.data.oldestDate) {
          setOldestDate(new Date(response.data.oldestDate));
        }
      } catch (e) {
        console.error("Failed to load oldest message date:", e);
      }
    };
    loadOldestDate();
  }, []);

  // Load graph data when dates change
  const loadGraphData = useCallback(async () => {
    setGraphLoading(true);
    try {
      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];
      
      const [messagesResponse, contactsResponse] = await Promise.all([
        dashboardApi.getMessagesGraph(fromDateStr, toDateStr),
        dashboardApi.getActiveContactsGraph(fromDateStr, toDateStr),
      ]);

      setMessagesGraphData(messagesResponse.data);
      setActiveContactsGraphData(contactsResponse.data);
    } catch (e) {
      console.error("Failed to load graph data:", e);
    } finally {
      setGraphLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

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

    const handleSyncComplete = (data: { messageCount: number; duration: number }) => {
      console.log(`WhatsApp sync complete: ${data.messageCount} messages synced in ${data.duration}ms`);
      // Refresh dashboard analytics after sync completes
      loadDashboardData();
    };

    socket.on("new_message", handleNewMessage);
    socket.on("whatsapp_sync_complete", handleSyncComplete);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("whatsapp_sync_complete", handleSyncComplete);
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

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Dashboard
        </h1>
      </div>

      {/* Section 1: Graphs with Date Filter */}
      <div className="space-y-4 animate-fade-in" style={{ animationDelay: '50ms' }}>
        {/* Date Filter */}
        <div className="flex justify-end">
          <DateFilter
            fromDate={fromDate}
            toDate={toDate}
            oldestDate={oldestDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
          />
        </div>

        {/* Graph Cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Messages
            </h3>
            <MessagesGraph data={messagesGraphData} loading={graphLoading} />
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Active Contacts
            </h3>
            <ActiveContactsGraph data={activeContactsGraphData} loading={graphLoading} />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-200 dark:border-zinc-700" />

      {/* Section 2: Relationships Health */}
      <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
        <RelationshipHealthCard health={stats.relationshipHealth} />
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-200 dark:border-zinc-700" />

      {/* Important Dates */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <UpcomingBirthdaysCard birthdays={stats.upcomingBirthdays} />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '350ms' }}>
          <UpcomingImportantDatesCard dates={stats.upcomingImportantDates} />
        </div>
      </div>
    </div>
  );
}
