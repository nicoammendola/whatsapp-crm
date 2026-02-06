"use client";

import { useEffect, useState, useRef } from "react";
import { messagesApi } from "@/lib/api";
import type { Message } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { format } from "date-fns";

export function MessageThread({
  contactId,
  fullHeight = false,
}: {
  contactId: string;
  fullHeight?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    messagesApi
      .getByContact(contactId, { limit: 50 })
      .then((res) => {
        if (!cancelled) {
          const list = res.data?.messages ?? [];
          setMessages(list.reverse());
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load messages");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex min-h-[120px] items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 py-4 text-center text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
        {error}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No messages yet with this contact.
      </div>
    );
  }

  let lastDate: string | null = null;

  return (
    <div
      className={`flex flex-col overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30 ${
        fullHeight ? "h-full" : "max-h-[60vh]"
      }`}
    >
      {messages.map((msg) => {
        const msgDate = format(new Date(msg.timestamp), "yyyy-MM-dd");
        const showDate = lastDate !== msgDate;
        if (showDate) lastDate = msgDate;
        return (
          <div key={msg.id}>
            {showDate && (
              <div className="my-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
                {format(new Date(msg.timestamp), "PPP")}
              </div>
            )}
            <MessageBubble message={msg} />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
