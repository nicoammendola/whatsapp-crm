"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";
import DashboardCard from "./DashboardCard";
import { dashboardApi } from "@/lib/api";
import { format, parseISO } from "date-fns";

const PAGE_SIZE = 5;

interface UpcomingScheduledMessage {
  id: string;
  contactId: string;
  messageText: string;
  scheduledTime: string;
  status: "pending" | "sending" | "llmSuggested";
  contact: {
    id: string;
    name: string | null;
    pushName: string | null;
    phoneNumber: string | null;
    profilePicUrl: string | null;
  };
  daysUntil: number;
  urgency: "low" | "medium" | "high";
  llmReasoning?: string | null;
  llmConfidence?: number | null;
}

const getContactName = (message: UpcomingScheduledMessage) => {
  const c = message.contact;
  return c?.name || c?.pushName || c?.phoneNumber || "Unknown";
};

const getDaysUntilText = (daysUntil: number) => {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `In ${daysUntil} days`;
};

const getItemStyle = () =>
  "border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700";

const PREVIEW_LEN = 50;

export default function ScheduledMessagesCard() {
  const [messages, setMessages] = useState<UpcomingScheduledMessage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMessages(0);
  }, []);

  const loadMessages = async (page: number) => {
    setLoading(true);
    try {
      const offset = page * PAGE_SIZE;
      const response = await dashboardApi.getUpcomingScheduledMessages(PAGE_SIZE, offset);
      setMessages(response.data.scheduledMessages);
      setTotal(response.data.total);
      setHasMore(response.data.hasMore);
    } catch (error) {
      console.error("Failed to load scheduled messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 0) {
      setCurrentPage(newPage);
      loadMessages(newPage);
    }
  };

  if (messages.length === 0 && !loading) {
    return (
      <DashboardCard title="Scheduled messages" icon={<Clock className="h-5 w-5" />}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No scheduled messages. Schedule messages from a contact's conversation to see them here.
        </p>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      title="Scheduled messages"
      icon={<Clock className="h-5 w-5" />}
    >
      {loading ? (
        <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Loading...
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {messages.map((message) => (
              <Link
                key={message.id}
                href={`/dashboard/conversations/${message.contactId}`}
                className={`block rounded-lg p-3 transition-colors ${getItemStyle()}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {message.status === "llmSuggested" && (
                        <span className="text-lg" aria-hidden>🤖</span>
                      )}
                      {message.daysUntil === 0 && message.status !== "llmSuggested" && (
                        <span className="text-lg" aria-hidden>⏰</span>
                      )}
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {getContactName(message)}
                      </p>
                      {message.status === "llmSuggested" && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          AI Suggested
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                      {message.messageText.length > PREVIEW_LEN
                        ? message.messageText.slice(0, PREVIEW_LEN) + "…"
                        : message.messageText}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                      {format(parseISO(message.scheduledTime), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {getDaysUntilText(message.daysUntil)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {total > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <button
                type="button"
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
                type="button"
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
