"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { messagesApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import type { Message } from "@/types";
import type { Contact } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { format } from "date-fns";

const PAGE_SIZE = 50;
const TEMP_ID_PREFIX = "temp-";

function isTempId(id: string): boolean {
  return id.startsWith(TEMP_ID_PREFIX);
}

export function MessageThread({
  contactId,
  contact,
  fullHeight = false,
}: {
  contactId: string;
  contact?: Contact | null;
  fullHeight?: boolean;
}) {
  const userId = useAuthStore((s) => s.user?.id);
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

  const addOptimisticMessage = useCallback((optimistic: Message) => {
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const replaceWithServerMessage = useCallback((serverMessage: Message) => {
    setMessages((prev) => {
      const byTemp = prev.find((m) => isTempId(m.id));
      const hasServer = prev.some((m) => m.id === serverMessage.id);
      const sortByTime = (list: Message[]) =>
        [...list].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      if (byTemp && !hasServer) {
        return sortByTime(
          prev.map((m) => (m.id === byTemp.id ? serverMessage : m))
        );
      }
      if (byTemp && hasServer) {
        return sortByTime(prev.filter((m) => m.id !== byTemp.id));
      }
      if (!byTemp && !hasServer) {
        return sortByTime([...prev, serverMessage]);
      }
      return prev;
    });
  }, []);

  const removeOptimisticOnError = useCallback(() => {
    setMessages((prev) => prev.filter((m) => !isTempId(m.id)));
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Polling for new messages (3s interval)
  useEffect(() => {
    if (!contactId || loading) return;
    
    const interval = setInterval(() => {
        if (loadingMoreRef.current) return;
        
        messagesApi.getByContact(contactId, { limit: 20, offset: 0 })
          .then((res) => {
             const list = res.data?.messages ?? [];
             if (list.length === 0) return;
             
             let hasNewMessages = false;
             
             setMessages((prev) => {
                 const existingIds = new Set(prev.map(m => m.id));
                 const newMessages = list.filter(m => !existingIds.has(m.id));
                 
                 // If no new messages, do nothing
                 if (newMessages.length === 0) return prev;
                 
                 hasNewMessages = true;
                 
                 // Merge and sort
                 const combined = [...prev];
                 for (const m of newMessages) {
                     // Filter out temp messages if they are replaced by real ones (simple check by body/type)
                     // or just rely on IDs not matching.
                     // A better check would be: if we have a temp message with same body and it's recent, remove it?
                     // But we rely on onSendSuccess to replace temp with real ID.
                     // The polling might fetch the message BEFORE onSendSuccess returns.
                     // In that case, we might have duplicates if we don't handle temp IDs carefully.
                     // But `onSendSuccess` replaces by ID logic.
                     // Here we just add new ones.
                     
                     // De-dupe by body/timestamp for temp messages?
                     // For now, just add.
                     combined.push(m);
                 }
                 
                 return combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
             });
             
             // Scroll to bottom if we are near bottom?
             // Or just let user scroll.
             // Usually we scroll if user is at bottom.
             if (hasNewMessages && scrollContainerRef.current) {
                 const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
                 const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
                 if (isAtBottom) {
                      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
                 }
             }
          })
          .catch(() => {});
    }, 3000);
    
    return () => clearInterval(interval);
  }, [contactId, loading]);

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

  let lastDate: string | null = null;

  return (
    <div className={`flex flex-1 flex-col min-h-0 ${fullHeight ? "h-full" : ""}`}>
      <div
        ref={scrollContainerRef}
        className={`flex flex-col overflow-y-auto bg-zinc-50/50 p-4 dark:bg-zinc-800/30 ${
          fullHeight ? "flex-1 min-h-0" : "max-h-[60vh]"
        }`}
      >
        {loading ? (
          <div className="flex min-h-[120px] items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 py-4 text-center text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </div>
        ) : (
          <>
            {loadingMore && (
              <div className="flex justify-center py-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </div>
            )}
            {messages.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No messages yet with this contact.
              </div>
            ) : (
              messages.map((msg) => {
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
                    <MessageBubble message={msg} contact={contact} />
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>
      <MessageInput
        contactId={contactId}
        onOptimisticMessage={addOptimisticMessage}
        onSendSuccess={replaceWithServerMessage}
        onSendError={removeOptimisticOnError}
      />
    </div>
  );
}
