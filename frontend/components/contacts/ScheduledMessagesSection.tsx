"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, Pencil, Trash2 } from "lucide-react";
import { scheduledMessagesApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { ScheduledMessage } from "@/types";
import { format, parseISO } from "date-fns";
import { ScheduleMessageModal } from "../messages/ScheduleMessageModal";

interface ScheduledMessagesSectionProps {
  contactId: string;
  onCountChange?: (count: number) => void;
}

const PREVIEW_LEN = 60;

export function ScheduledMessagesSection({ contactId, onCountChange }: ScheduledMessagesSectionProps) {
  const [list, setList] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await scheduledMessagesApi.getByContact(contactId);
      const items = (res.data?.scheduledMessages ?? []).filter(
        (m) => 
          m.status === "pending" || 
          m.status === "sending" || 
          m.status === "sent" || 
          m.status === "failed" ||
          m.status === "llmSuggested"
      );
      setList(items);
      if (onCountChange) {
        onCountChange(items.length);
      }
    } catch (err) {
      console.error("Failed to load scheduled messages:", err);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    load();
  }, [load]);

  // Update count when list changes
  useEffect(() => {
    if (onCountChange) {
      onCountChange(list.length);
    }
  }, [list.length, onCountChange]);

  // Refetch when a scheduled message is created from elsewhere (e.g. conversation page)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ contactId: string }>).detail;
      if (detail?.contactId === contactId) load();
    };
    window.addEventListener("scheduled-message-created", handler);
    return () => window.removeEventListener("scheduled-message-created", handler);
  }, [contactId, load]);

  // Supabase realtime: subscribe to scheduled_messages for this contact
  useEffect(() => {
    const client = supabase;
    if (!client || !contactId) return;
    const channel = client
      .channel(`scheduled_messages:${contactId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scheduled_messages",
          filter: `contactId=eq.${contactId}`,
        },
        () => {
          load();
        }
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [contactId, load]);

  const handleUpdate = async () => {
    // If editing an LLM-suggested message, approve it after update
    if (editItem && editItem.status === "llmSuggested") {
      await handleApprove(editItem.id);
    }
    setEditId(null);
    load();
  };

  const handleDelete = async (id: string) => {
    try {
      await scheduledMessagesApi.delete(id);
      setDeleteConfirmId(null);
      load();
    } catch (err) {
      console.error("Failed to delete scheduled message:", err);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await scheduledMessagesApi.approve(id);
      load();
    } catch (err) {
      console.error("Failed to approve scheduled message:", err);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Reject this AI suggestion?")) return;
    try {
      await scheduledMessagesApi.reject(id);
      load();
    } catch (err) {
      console.error("Failed to reject scheduled message:", err);
    }
  };

  const handleEditAndApprove = (id: string) => {
    setEditId(id);
  };

  const editItem = editId ? list.find((m) => m.id === editId) : null;

  return (
    <div>
      {loading ? (
        <div className="text-xs text-zinc-400 dark:text-zinc-500">Loading scheduled messages...</div>
      ) : list.length === 0 ? (
        <div className="text-xs text-zinc-400 dark:text-zinc-500">No scheduled messages</div>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <Clock className="h-4 w-4" />
            Scheduled messages
          </div>
      <ul className="space-y-2">
        {list.map((m) => {
          if (m.status === "llmSuggested") {
            return <LLMSuggestedCard key={m.id} message={m} onApprove={handleApprove} onEdit={handleEditAndApprove} onReject={handleReject} />;
          }
          
          return (
            <li
              key={m.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-zinc-200 bg-white py-2 pl-2 pr-2 dark:border-zinc-600 dark:bg-zinc-800/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-zinc-900 dark:text-zinc-100">
                  {m.messageText.length > PREVIEW_LEN
                    ? m.messageText.slice(0, PREVIEW_LEN) + "…"
                    : m.messageText}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {m.status === "sent" && m.sentAt
                    ? format(parseISO(m.sentAt), "MMM d, yyyy 'at' h:mm a")
                    : format(parseISO(m.scheduledTime), "MMM d, yyyy 'at' h:mm a")}
                  {" · "}
                  <StatusBadge status={m.status} />
                  {m.status === "failed" && m.errorMessage && (
                    <span className="ml-1" title={m.errorMessage}>
                      (error)
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-0.5">
                {(m.status === "pending" || m.status === "failed") && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditId(m.id)}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {deleteConfirmId === m.id ? (
                      <span className="flex items-center gap-1 text-xs">
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id)}
                          className="text-red-600 dark:text-red-400"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-zinc-500"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(m.id)}
                        className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-zinc-700 dark:hover:text-red-400"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
        </ul>
        </>
      )}
      {editItem && (
        <ScheduleMessageModal
          open={!!editId}
          onClose={() => setEditId(null)}
          contactId={contactId}
          initialText={editItem.messageText}
          initialScheduledTime={editItem.scheduledTime}
          scheduledMessageId={editItem.id}
          onSuccess={handleUpdate}
        />
      )}
    </div>
  );
}

function LLMSuggestedCard({
  message,
  onApprove,
  onEdit,
  onReject,
}: {
  message: ScheduledMessage;
  onApprove: (id: string) => void;
  onEdit: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [showReasoning, setShowReasoning] = useState(false);

  return (
    <li className="rounded-lg border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-white p-4 shadow dark:border-blue-800 dark:from-blue-900/20 dark:to-zinc-800">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">AI Suggested</span>
        </div>
        {message.llmConfidence && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">Confidence:</span>
            <div className="h-2 w-16 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div className="h-full bg-blue-600" style={{ width: `${message.llmConfidence * 100}%` }} />
            </div>
            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
              {Math.round(message.llmConfidence * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Message */}
      <div className="mb-3">
        <div className="rounded border border-zinc-200 bg-white p-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
          {message.messageText}
        </div>
      </div>

      {/* Scheduled Time */}
      <div className="mb-3 text-xs text-zinc-600 dark:text-zinc-400">
        📅 Scheduled: {format(parseISO(message.scheduledTime), "MMM d, yyyy 'at' h:mm a")}
      </div>

      {/* Reasoning */}
      {message.llmReasoning && (
        <div className="mb-3">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            💡 Why this suggestion? {showReasoning ? "▲" : "▼"}
          </button>
          {showReasoning && (
            <div className="mt-2 rounded bg-blue-50 p-2 text-xs text-zinc-600 dark:bg-blue-900/20 dark:text-zinc-400">
              {message.llmReasoning}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onApprove(message.id)}
          className="flex-1 rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
        >
          ✓ Approve
        </button>
        <button
          onClick={() => onEdit(message.id)}
          className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
        >
          ✏️ Edit & Approve
        </button>
        <button
          onClick={() => onReject(message.id)}
          className="rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
        >
          ✗
        </button>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: ScheduledMessage["status"] }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    sending: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    sent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
    llmSuggested: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    userRejected: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
  };
  return (
    <span
      className={`inline rounded px-1.5 py-0.5 text-xs font-medium ${styles[status] ?? ""}`}
    >
      {status}
    </span>
  );
}
