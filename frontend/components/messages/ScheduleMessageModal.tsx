"use client";

import { useState, useEffect } from "react";
import { format, isBefore } from "date-fns";
import { scheduledMessagesApi } from "@/lib/api";
import type { ScheduledMessage } from "@/types";

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function getLocalDateAndTime(date: Date): { dateStr: string; timeStr: string } {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return {
    dateStr: `${y}-${m}-${d}`,
    timeStr: `${h}:${min}`,
  };
}

function buildUtcFromLocal(dateStr: string, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const local = new Date(dateStr + "T00:00:00");
  local.setHours(hours, minutes, 0, 0);
  return local;
}

export function ScheduleMessageModal({
  open,
  onClose,
  contactId,
  initialText = "",
  initialScheduledTime,
  scheduledMessageId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  contactId: string;
  initialText?: string;
  initialScheduledTime?: string | null;
  scheduledMessageId?: string | null;
  onSuccess?: (scheduled: ScheduledMessage) => void;
}) {
  const [messageText, setMessageText] = useState(initialText);
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("12:00");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!scheduledMessageId;

  useEffect(() => {
    if (!open) return;
    setMessageText(initialText);
    setError(null);
    const now = new Date();
    const defaultSchedule = new Date(now.getTime() + 60 * 60 * 1000);
    const { dateStr: d, timeStr: t } = initialScheduledTime
      ? getLocalDateAndTime(new Date(initialScheduledTime))
      : getLocalDateAndTime(defaultSchedule);
    setDateStr(d);
    setTimeStr(t);
  }, [open, initialText, initialScheduledTime]);

  const scheduledLocal = dateStr && timeStr ? buildUtcFromLocal(dateStr, timeStr) : null;
  const now = new Date();
  const minDate = format(now, "yyyy-MM-dd");
  const isInPast = scheduledLocal ? isBefore(scheduledLocal, now) : false;

  const handleSubmit = async () => {
    if (!messageText.trim()) {
      setError("Message text is required");
      return;
    }
    if (!dateStr || !timeStr) {
      setError("Please set date and time");
      return;
    }
    if (isInPast) {
      setError("Scheduled time must be in the future");
      return;
    }
    const scheduledTime = buildUtcFromLocal(dateStr, timeStr);
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit && scheduledMessageId) {
        const { data } = await scheduledMessagesApi.update(scheduledMessageId, {
          messageText: messageText.trim(),
          scheduledTime: scheduledTime.toISOString(),
        });
        onSuccess?.(data.scheduledMessage);
      } else {
        const { data } = await scheduledMessagesApi.create({
          contactId,
          messageText: messageText.trim(),
          scheduledTime: scheduledTime.toISOString(),
        });
        onSuccess?.(data.scheduledMessage);
      }
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {isEdit ? "Reschedule message" : "Schedule message"}
          </h3>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Message
            </label>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message..."
              rows={3}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Date
              </label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                min={minDate}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Time
              </label>
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>
          <div className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            <span className="font-medium">Timezone: </span>
            {timezone}
          </div>
          {scheduledLocal && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Preview: {format(scheduledLocal, "EEE, MMM d, yyyy 'at' h:mm a")} ({timezone})
            </p>
          )}
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || isInPast || !messageText.trim()}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "Saving…" : isEdit ? "Update" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
