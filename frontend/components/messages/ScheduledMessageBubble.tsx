"use client";

import type { ScheduledMessage } from "@/types";
import { format } from "date-fns";

export function ScheduledMessageBubble({
  scheduled,
  isLastInGroup = true,
}: {
  scheduled: ScheduledMessage;
  isLastInGroup?: boolean;
}) {
  const isSent = scheduled.status === "sent";
  const isPending =
    scheduled.status === "pending" || scheduled.status === "sending";
  const isFailed = scheduled.status === "failed";

  const displayTime =
    scheduled.status === "sent" && scheduled.sentAt
      ? scheduled.sentAt
      : scheduled.scheduledTime;

  return (
    <div
      className={`flex justify-end ${isLastInGroup ? "mb-2" : "mb-[3px]"}`}
    >
      <div className="flex max-w-[75%] flex-col items-end">
        <div
          className={`rounded-lg px-2.5 py-1.5 shadow-sm ${
            isSent
              ? "bg-[#d9fdd3] text-zinc-900 dark:bg-[#005c4b] dark:text-zinc-100"
              : isFailed
                ? "bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-200"
                : "border border-dashed border-zinc-300 bg-white/80 text-zinc-700 dark:border-zinc-500 dark:bg-zinc-700/60 dark:text-zinc-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {!isSent && (
              <svg
                className="h-4 w-4 shrink-0 opacity-70"
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
          <div className="mt-0.5 flex items-center justify-end gap-2">
            {isFailed && scheduled.errorMessage && (
              <span
                className="text-xs opacity-90"
                title={scheduled.errorMessage}
              >
                Failed
              </span>
            )}
            <span
              className={`text-[11px] ${
                isSent
                  ? "text-[#667781] dark:text-zinc-400"
                  : isFailed
                    ? "text-red-700 dark:text-red-300"
                    : "text-zinc-500 dark:text-zinc-400"
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
