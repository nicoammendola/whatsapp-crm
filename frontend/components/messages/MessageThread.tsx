"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { messagesApi, whatsappApi, scheduledMessagesApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useSocket } from "@/lib/socket";
import { supabase } from "@/lib/supabase";
import type { Message } from "@/types";
import type { Contact, ScheduledMessage } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { ScheduledMessageBubble } from "./ScheduledMessageBubble";
import { MessageInput } from "./MessageInput";
import { format } from "date-fns";

const PAGE_SIZE = 50;
const TEMP_ID_PREFIX = "temp-";

function isTempId(id: string): boolean {
  return id.startsWith(TEMP_ID_PREFIX);
}

function sortByTime(list: Message[]): Message[] {
  return [...list].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
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
  const socket = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [scheduledList, setScheduledList] = useState<ScheduledMessage[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const messagesCountRef = useRef(0);
  const syncedRef = useRef(false);

  useEffect(() => {
    messagesCountRef.current = messages.length;
  }, [messages.length]);

  const loadScheduled = useCallback(async () => {
    try {
      const res = await scheduledMessagesApi.getByContact(contactId);
      const list = (res.data?.scheduledMessages ?? []).filter(
        (m) => m.status !== "cancelled"
      );
      setScheduledList(list);
    } catch {
      setScheduledList([]);
    }
  }, [contactId]);

  useEffect(() => {
    loadScheduled();
  }, [loadScheduled]);

  useEffect(() => {
    const client = supabase;
    if (!client || !contactId) return;
    const channel = client
      .channel(`scheduled_messages_thread:${contactId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scheduled_messages",
          filter: `contactId=eq.${contactId}`,
        },
        loadScheduled
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [contactId, loadScheduled]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    messagesApi.markAsRead(contactId).catch(() => {});

    try {
      const res = await messagesApi.getByContact(contactId, {
        limit: PAGE_SIZE,
        offset: 0,
      });
      const list = res.data?.messages ?? [];
      setMessages(list.reverse());
      setHasMore(list.length === PAGE_SIZE);

      if (list.length === 0 && !syncedRef.current) {
        syncedRef.current = true;
        setSyncing(true);

        try {
          const statusRes = await whatsappApi.getStatus();
          if (!statusRes.data.connected) {
            setSyncing(false);
            return;
          }

          await messagesApi.syncContactMessages(contactId, 100);
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const retryRes = await messagesApi.getByContact(contactId, {
            limit: PAGE_SIZE,
            offset: 0,
          });
          const retryList = retryRes.data?.messages ?? [];
          setMessages(retryList.reverse());
          setHasMore(retryList.length === PAGE_SIZE);
        } catch (syncError: any) {
          if (syncError.response?.status !== 503) {
            console.warn(
              "Message sync failed:",
              syncError.response?.data?.error || syncError.message
            );
          }
        } finally {
          setSyncing(false);
        }
      }
    } catch (err) {
      setError("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  const loadOlder = useCallback(() => {
    if (loadingMoreRef.current || !hasMore || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const offset = messagesCountRef.current;
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
  }, [contactId, hasMore, loading]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior });
    }, 50);
  }, []);

  const isAtBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollTop > -100;
  }, []);

  const addOptimisticMessage = useCallback(
    (optimistic: Message) => {
      setMessages((prev) => [...prev, optimistic]);
      scrollToBottom();
    },
    [scrollToBottom]
  );

  const replaceWithServerMessage = useCallback((serverMessage: Message) => {
    setMessages((prev) => {
      const byTemp = prev.find((m) => isTempId(m.id));
      const hasServer = prev.some((m) => m.id === serverMessage.id);
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
    syncedRef.current = false;
    loadInitial();
  }, [loadInitial]);

  // Listen for real-time messages via socket
  useEffect(() => {
    if (!socket || !contactId || loading) return;

    const handleNewMessage = (messageData: Message) => {
      if (messageData.contactId !== contactId) return;

      let wasAdded = false;

      setMessages((prev) => {
        const exists = prev.some((m) => m.id === messageData.id);
        if (exists) return prev;

        // Replace optimistic temp message instead of adding alongside it
        if (messageData.fromMe) {
          const tempIdx = prev.findIndex((m) => isTempId(m.id));
          if (tempIdx !== -1) {
            wasAdded = true;
            return sortByTime(
              prev.map((m, i) => (i === tempIdx ? messageData : m))
            );
          }
        }

        wasAdded = true;
        return sortByTime([...prev, messageData]);
      });

      if (wasAdded && isAtBottom()) {
        scrollToBottom();
      }
    };

    const handleMessageUpdated = (messageData: Message) => {
      if (messageData.contactId !== contactId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageData.id ? { ...m, ...messageData } : m
        )
      );
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_updated", handleMessageUpdated);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_updated", handleMessageUpdated);
    };
  }, [socket, contactId, loading, isAtBottom, scrollToBottom]);

  // Polling for new messages (3s interval) - fallback if socket fails
  useEffect(() => {
    if (!contactId || loading) return;

    const interval = setInterval(() => {
      if (loadingMoreRef.current) return;

      messagesApi
        .getByContact(contactId, { limit: 20, offset: 0 })
        .then((res) => {
          const list = res.data?.messages ?? [];
          if (list.length === 0) return;

          let hasNewMessages = false;

          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newMessages = list.filter((m) => !existingIds.has(m.id));

            if (newMessages.length === 0) return prev;

            hasNewMessages = true;
            const updated = [...prev];

            for (const m of newMessages) {
              if (m.fromMe) {
                const tempIdx = updated.findIndex((x) => isTempId(x.id));
                if (tempIdx !== -1) {
                  updated[tempIdx] = m;
                  continue;
                }
              }
              updated.push(m);
            }

            return updated.sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
            );
          });

          if (hasNewMessages && isAtBottom()) {
            scrollToBottom();
          }
        })
        .catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [contactId, loading, isAtBottom, scrollToBottom]);

  // IntersectionObserver for loading older messages when scrolling up
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadOlder();
      },
      { root, rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadOlder]);

  type TimelineItem =
    | { type: "message"; id: string; timestamp: string; message: Message }
    | {
        type: "scheduled";
        id: string;
        timestamp: string;
        scheduled: ScheduledMessage;
      };

  const unsentScheduled = scheduledList.filter((sm) => sm.status !== "sent");

  const timelineItems: TimelineItem[] = [
    ...messages.map((msg) => ({
      type: "message" as const,
      id: msg.id,
      timestamp: msg.timestamp,
      message: msg,
    })),
    ...unsentScheduled.map((sm) => ({
      type: "scheduled" as const,
      id: sm.id,
      timestamp: sm.scheduledTime,
      scheduled: sm,
    })),
  ].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let lastDate: string | null = null;

  return (
    <div
      className={`flex flex-1 flex-col min-h-0 ${fullHeight ? "h-full" : ""}`}
    >
      <div
        ref={scrollContainerRef}
        className={`flex flex-col-reverse overflow-y-auto bg-[#efeae2] px-4 py-2 dark:bg-zinc-800 ${
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
          <div className="flex flex-col">
            {hasMore && <div ref={topSentinelRef} className="h-1" />}
            {loadingMore && (
              <div className="flex justify-center py-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </div>
            )}
            {timelineItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {syncing ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    <span>Checking for messages...</span>
                  </div>
                ) : (
                  "No messages yet with this contact."
                )}
              </div>
            ) : (
              timelineItems.map((item, index) => {
                const ts = item.timestamp;
                const msgDate = format(new Date(ts), "yyyy-MM-dd");
                const showDate = lastDate !== msgDate;
                if (showDate) lastDate = msgDate;

                const prev = index > 0 ? timelineItems[index - 1] : null;
                const next =
                  index < timelineItems.length - 1
                    ? timelineItems[index + 1]
                    : null;

                const sameGroup = (
                  a: TimelineItem | null,
                  b: TimelineItem | null
                ) => {
                  if (!a || !b) return false;
                  if (a.type !== "message" || b.type !== "message")
                    return false;
                  return a.message.fromMe === b.message.fromMe;
                };

                const showTail = showDate || !sameGroup(prev, item);
                const nextDate = next
                  ? format(new Date(next.timestamp), "yyyy-MM-dd")
                  : null;
                const isLastInGroup =
                  !sameGroup(item, next) ||
                  (nextDate !== null && nextDate !== msgDate);

                return (
                  <div key={item.id}>
                    {showDate && (
                      <div className="my-3 flex justify-center">
                        <span className="rounded-lg bg-white/90 px-3 py-1 text-[12px] text-zinc-600 shadow-sm dark:bg-zinc-700/90 dark:text-zinc-300">
                          {format(new Date(ts), "PPP")}
                        </span>
                      </div>
                    )}
                    {item.type === "message" ? (
                      <MessageBubble
                        message={item.message}
                        contact={contact}
                        showTail={showTail}
                        isLastInGroup={isLastInGroup}
                      />
                    ) : (
                      <ScheduledMessageBubble
                        scheduled={item.scheduled}
                        isLastInGroup={isLastInGroup}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
      <MessageInput
        contactId={contactId}
        onOptimisticMessage={addOptimisticMessage}
        onSendSuccess={replaceWithServerMessage}
        onSendError={removeOptimisticOnError}
        onScheduled={loadScheduled}
      />
    </div>
  );
}
