"use client";

import type { ScheduledMessage } from "@/types";
import { format } from "date-fns";

export function ScheduledMessageBubble({
  scheduled,
}: {
  scheduled: ScheduledMessage;
}) {
  const isSent = scheduled.status === "sent";
  const isPending = scheduled.status === "pending" || scheduled.status === "sending";
  const isFailed = scheduled.status === "failed";

  const displayTime = scheduled.status === "sent" && scheduled.sentAt
    ? scheduled.sentAt
    : scheduled.scheduledTime;

  return (
    <div className="mb-2 flex justify-end">
      <div className="flex max-w-[75%] flex-col items-end">
        <div
          className={`rounded-2xl px-4 py-2 ${
            isSent
              ? "bg-emerald-600 text-white"
              : isFailed
                ? "bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-200"
                : "bg-zinc-200 text-zinc-700 dark:bg-zinc-600 dark:text-zinc-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {!isSent && (
              <svg
                className="h-4 w-4 shrink-0 opacity-80"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            <span className="whitespace-pre-wrap break-words text-sm">
              {scheduled.messageText}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-end gap-2">
            {isFailed && scheduled.errorMessage && (
              <span className="text-xs opacity-90" title={scheduled.errorMessage}>
                Failed
              </span>
            )}
            <span
              className={`text-xs ${
                isSent
                  ? "text-emerald-100"
                  : isFailed
                    ? "text-red-700 dark:text-red-300"
                    : "opacity-80"
              }`}
            >
              {isPending
                ? `Scheduled for ${format(new Date(displayTime), "MMM d, HH:mm")}`
                : format(new Date(displayTime), "HH:mm")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
