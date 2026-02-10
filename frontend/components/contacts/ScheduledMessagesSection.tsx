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
}

const PREVIEW_LEN = 60;

export function ScheduledMessagesSection({ contactId }: ScheduledMessagesSectionProps) {
  const [list, setList] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await scheduledMessagesApi.getByContact(contactId);
      const items = (res.data?.scheduledMessages ?? []).filter(
        (m) => m.status === "pending" || m.status === "sending" || m.status === "sent" || m.status === "failed"
      );
      setList(items);
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

  const editItem = editId ? list.find((m) => m.id === editId) : null;

  // Only show section when there are scheduled messages (pending/sending/sent/failed)
  if (loading && list.length === 0) return null;
  if (!loading && list.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        <Clock className="h-4 w-4" />
        Scheduled messages
      </div>
      <ul className="space-y-2">
        {list.map((m) => (
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
        ))}
      </ul>
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

function StatusBadge({ status }: { status: ScheduledMessage["status"] }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    sending: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    sent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
  };
  return (
    <span
      className={`inline rounded px-1.5 py-0.5 text-xs font-medium ${styles[status] ?? ""}`}
    >
      {status}
    </span>
  );
}
