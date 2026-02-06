"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { messagesApi } from "@/lib/api";
import type { Message } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { format } from "date-fns";

const PAGE_SIZE = 50;

export function MessageThread({
  contactId,
  fullHeight = false,
}: {
  contactId: string;
  fullHeight?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const loadInitial = useCallback(() => {
    setLoading(true);
    setError(null);
    // Mark as read
    messagesApi.markAsRead(contactId).catch(() => {});
    
    messagesApi
      .getByContact(contactId, { limit: PAGE_SIZE, offset: 0 })
      .then((res) => {
        const list = res.data?.messages ?? [];
        setMessages(list.reverse());
        setHasMore(list.length === PAGE_SIZE);
      })
      .catch(() => setError("Failed to load messages"))
      .finally(() => setLoading(false));
  }, [contactId]);

  const loadOlder = useCallback(() => {
    if (loadingMoreRef.current || !hasMore || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const offset = messages.length;
    messagesApi
      .getByContact(contactId, { limit: PAGE_SIZE, offset })
      .then((res) => {
        const list = res.data?.messages ?? [];
        setHasMore(list.length === PAGE_SIZE);
        setMessages((prev) => [...list.reverse(), ...prev]);
      })
      .catch(() => {})
      .finally(() => {
        setLoadingMore(false);
        loadingMoreRef.current = false;
      });
  }, [contactId, messages.length, hasMore, loading]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages.length]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !hasMore || loading || loadingMore) return;
    const handleScroll = () => {
      if (el.scrollTop < 80) loadOlder();
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [hasMore, loading, loadingMore, loadOlder]);

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
      ref={scrollContainerRef}
      className={`flex flex-col overflow-y-auto bg-zinc-50/50 p-4 dark:bg-zinc-800/30 ${
        fullHeight ? "h-full" : "max-h-[60vh]"
      }`}
    >
      {loadingMore && (
        <div className="flex justify-center py-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      )}
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
