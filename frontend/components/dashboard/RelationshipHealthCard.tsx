"use client";

import { useState, useEffect } from "react";
import { Activity, ChevronRight, ChevronLeft, CheckCircle2, Circle } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import DashboardCard from "./DashboardCard";
import { dashboardApi, contactsApi, type HealthStatusContact, type AwaitingReplyContact } from "@/lib/api";
import type { RelationshipHealth } from "@/types";

const PAGE_SIZE = 10;

interface RelationshipHealthCardProps {
  health: RelationshipHealth;
}

type HealthStatus = "toReply" | "awaitingReply" | "needsAttention" | "atRisk" | "onTrack" | null;

const getScoreColor = () => "text-zinc-900 dark:text-zinc-100";
const getScoreBgColor = () => "bg-zinc-500 dark:bg-zinc-400";

const getStatusColor = (status: HealthStatus) => {
  switch (status) {
    case "toReply":
    case "awaitingReply":
    case "onTrack":
    case "needsAttention":
    case "atRisk":
      return "border-zinc-300 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700";
    default:
      return "";
  }
};

const formatFrequency = (frequency: string | null | undefined) => {
  if (!frequency) return "";
  const frequencyMap: Record<string, string> = {
    daily: "Daily",
    weekly: "Weekly",
    biweekly: "Bi-weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    yearly: "Yearly",
  };
  return frequencyMap[frequency] || frequency;
};

const getContactName = (contact: HealthStatusContact | AwaitingReplyContact) => {
  return contact.name || contact.pushName || contact.phoneNumber || "Unknown";
};

const getContactInitial = (contact: HealthStatusContact | AwaitingReplyContact) => {
  const name = getContactName(contact);
  return name.charAt(0).toUpperCase() || "?";
};

export default function RelationshipHealthCard({ health }: RelationshipHealthCardProps) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<HealthStatus>("toReply");
  const [contacts, setContacts] = useState<(HealthStatusContact | AwaitingReplyContact)[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [toReplyCount, setToReplyCount] = useState(0);
  const [awaitingReplyCount, setAwaitingReplyCount] = useState(0);

  const scoreColor = getScoreColor();
  const scoreBgColor = getScoreBgColor();

  // Load To reply and Awaiting reply counts on mount
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [toReplyRes, awaitingReplyRes] = await Promise.all([
          dashboardApi.getToReplies(1, 0),
          dashboardApi.getAwaitingReply(1, 0),
        ]);
        setToReplyCount(toReplyRes.data.total);
        setAwaitingReplyCount(awaitingReplyRes.data.total);
      } catch (error) {
        console.error("Failed to load reply counts:", error);
      }
    };
    loadCounts();
  }, []);

  useEffect(() => {
    if (selectedStatus) {
      setCurrentPage(0);
      loadContacts(selectedStatus, 0);
    } else {
      setContacts([]);
      setTotal(0);
      setHasMore(false);
    }
  }, [selectedStatus]);

  const loadContacts = async (status: HealthStatus, page: number) => {
    if (!status) return;
    setLoading(true);
    try {
      const offset = page * PAGE_SIZE;
      if (status === "toReply") {
        const response = await dashboardApi.getToReplies(PAGE_SIZE, offset);
        setContacts(response.data.contacts);
        setTotal(response.data.total);
        setHasMore(response.data.hasMore);
      } else if (status === "awaitingReply") {
        const response = await dashboardApi.getAwaitingReply(PAGE_SIZE, offset);
        setContacts(response.data.contacts);
        setTotal(response.data.total);
        setHasMore(response.data.hasMore);
      } else {
        const response = await dashboardApi.getContactsByHealthStatus(status, PAGE_SIZE, offset);
        setContacts(response.data.contacts);
        setTotal(response.data.total);
        setHasMore(response.data.hasMore);
      }
    } catch (error) {
      console.error("Failed to load contacts:", error);
      setContacts([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (selectedStatus && newPage >= 0) {
      setCurrentPage(newPage);
      loadContacts(selectedStatus, newPage);
    }
  };

  const handleStatusClick = (status: HealthStatus) => {
    if (selectedStatus === status) {
      setSelectedStatus(null);
    } else {
      setSelectedStatus(status);
    }
  };

  const handleContactClick = (contactId: string) => {
    router.push(`/dashboard/conversations/${contactId}`);
  };

  const handleToggleOkWithoutReply = async (
    e: React.MouseEvent,
    contactId: string,
    currentValue: boolean
  ) => {
    e.stopPropagation(); // Prevent navigation when clicking the icon
    try {
      await contactsApi.update(contactId, { okWithoutReply: !currentValue });
      // Reload the current list
      if (selectedStatus) {
        loadContacts(selectedStatus, currentPage);
      }
      // Refresh count for current section after toggle
      if (selectedStatus === "toReply") {
        const response = await dashboardApi.getToReplies(1, 0);
        setToReplyCount(response.data.total);
      } else if (selectedStatus === "awaitingReply") {
        const response = await dashboardApi.getAwaitingReply(1, 0);
        setAwaitingReplyCount(response.data.total);
      }
    } catch (error) {
      console.error("Failed to toggle ok without reply:", error);
    }
  };

  if (health.total === 0) {
    return (
      <DashboardCard title="Relationships Health" icon={<Activity className="h-5 w-5" />}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Set contact frequency targets to track relationship health.
        </p>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Relationships Health" icon={<Activity className="h-5 w-5" />}>
      <div className="space-y-4">
        {/* Overall Score */}
        <div className="text-center">
          <p className={`text-5xl font-bold ${scoreColor}`}>{health.score}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">out of 100</p>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className={`h-full ${scoreBgColor} transition-all`}
              style={{ width: `${health.score}%` }}
            />
          </div>
        </div>

        {/* Status Counters: To reply, Awaiting reply, Need attention, At risk, On track */}
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700 sm:grid-cols-3 lg:grid-cols-5">
          <button
            onClick={() => handleStatusClick("toReply")}
            className={`rounded-lg border p-3 text-center transition-all ${
              selectedStatus === "toReply"
                ? getStatusColor("toReply")
                : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <div className="h-2 w-2 rounded-full bg-zinc-500 dark:bg-zinc-400" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                To reply
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {toReplyCount}
            </p>
          </button>

          <button
            onClick={() => handleStatusClick("awaitingReply")}
            className={`rounded-lg border p-3 text-center transition-all ${
              selectedStatus === "awaitingReply"
                ? getStatusColor("awaitingReply")
                : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <div className="h-2 w-2 rounded-full bg-zinc-500 dark:bg-zinc-400" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Awaiting reply
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {awaitingReplyCount}
            </p>
          </button>

          <button
            onClick={() => handleStatusClick("needsAttention")}
            className={`rounded-lg border p-3 text-center transition-all ${
              selectedStatus === "needsAttention"
                ? getStatusColor("needsAttention")
                : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <div className="h-2 w-2 rounded-full bg-zinc-500 dark:bg-zinc-400" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Need attention
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {health.needsAttention}
            </p>
          </button>

          <button
            onClick={() => handleStatusClick("atRisk")}
            className={`rounded-lg border p-3 text-center transition-all ${
              selectedStatus === "atRisk"
                ? getStatusColor("atRisk")
                : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <div className="h-2 w-2 rounded-full bg-zinc-500 dark:bg-zinc-400" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                At risk
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {health.atRisk}
            </p>
          </button>

          <button
            onClick={() => handleStatusClick("onTrack")}
            className={`rounded-lg border p-3 text-center transition-all ${
              selectedStatus === "onTrack"
                ? getStatusColor("onTrack")
                : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <div className="h-2 w-2 rounded-full bg-zinc-500 dark:bg-zinc-400" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                On track
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {health.onTrack}
            </p>
          </button>
        </div>

        {/* Contacts Table */}
        {selectedStatus && (
          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {selectedStatus === "toReply" && "To Reply"}
                {selectedStatus === "awaitingReply" && "Awaiting Reply"}
                {selectedStatus === "onTrack" && "On Track Contacts"}
                {selectedStatus === "needsAttention" && "Contacts Needing Attention"}
                {selectedStatus === "atRisk" && "At Risk Contacts"}
              </h4>
              {total > 0 && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {total} total
                </span>
              )}
            </div>
            {loading ? (
              <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Loading...
              </div>
            ) : contacts.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No contacts in this category.
              </div>
            ) : (
              <>
                <div className="space-y-0.5">
                  {contacts.map((contact) => {
                    const isOkWithoutReply = "okWithoutReply" in contact ? (contact.okWithoutReply ?? false) : false;
                    return (
                      <div
                        key={contact.id}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <button
                          onClick={() => handleContactClick(contact.id)}
                          className="flex flex-1 items-center gap-2 text-left"
                        >
                          {/* Avatar - Smaller */}
                          {contact.profilePicUrl ? (
                            <img
                              src={contact.profilePicUrl}
                              alt=""
                              className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-400 text-xs font-semibold text-white dark:bg-zinc-600">
                              {getContactInitial(contact)}
                            </div>
                          )}

                          {/* Contact Info - More Compact */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                {getContactName(contact)}
                              </p>
                              {(selectedStatus === "needsAttention" || selectedStatus === "atRisk") &&
                                "contactFrequency" in contact &&
                                contact.contactFrequency && (
                                  <span className="flex-shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                    {formatFrequency(contact.contactFrequency)}
                                  </span>
                                )}
                              {(selectedStatus === "needsAttention" || selectedStatus === "atRisk") &&
                                "daysOverdue" in contact &&
                                contact.daysOverdue !== undefined && (
                                  <span className="flex-shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                                    {contact.daysOverdue} days overdue
                                  </span>
                                )}
                              {contact.lastMessageTime && (
                                <span className="flex-shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                                  {formatDistanceToNow(new Date(contact.lastMessageTime), {
                                    addSuffix: true,
                                  })}
                                </span>
                              )}
                            </div>
                            {contact.lastMessageSnippet && (
                              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                                {contact.lastMessageSnippet}
                              </p>
                            )}
                          </div>

                          {/* Arrow - Smaller */}
                          <ChevronRight className="h-4 w-4 flex-shrink-0 text-zinc-400 dark:text-zinc-500" />
                        </button>

                        {/* OK Without Reply Toggle - show for To reply and Awaiting reply */}
                        {(selectedStatus === "toReply" || selectedStatus === "awaitingReply") && (
                          <button
                            onClick={(e) => handleToggleOkWithoutReply(e, contact.id, isOkWithoutReply)}
                            className="flex-shrink-0 rounded p-1.5 transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            title={isOkWithoutReply ? "Mark as needs reply" : "Mark as OK without reply"}
                          >
                            {isOkWithoutReply ? (
                              <CheckCircle2 className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                            ) : (
                              <Circle className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
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
          </div>
        )}

        {/* Top Suggestion */}
        {health.topSuggestion && !selectedStatus && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              💡 {health.topSuggestion}
            </p>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
