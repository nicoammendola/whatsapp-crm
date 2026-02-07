"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { messagesApi } from "@/lib/api";
import type { Conversation } from "@/lib/api";
import type { Contact } from "@/types";
import { Input } from "@/components/ui/Input";
import { formatDistanceToNow } from "date-fns";

const PAGE_SIZE = 20;

interface ConversationListProps {
  selectedContactId?: string | null;
}

export function ConversationList({ selectedContactId }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currentSearch, setCurrentSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadConversations = async (append: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    
    const offset = append ? conversations.length : 0;
    if (append) setLoadingMore(true);
    else setLoading(true);
    
    try {
      setError(null);
      const { data } = await messagesApi.getConversations({
        limit: PAGE_SIZE,
        offset,
        search: currentSearch || undefined,
      });
      const list = data.conversations ?? [];
      setHasMore(data.hasMore ?? false);
      setConversations((prev) => (append ? [...prev, ...list] : list));
    } catch {
      setError("Failed to load conversations");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      loadingRef.current = false;
    }
  };

  // Initial load
  useEffect(() => {
    loadConversations(false);
  }, [currentSearch]);

  // Search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setCurrentSearch(search);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  // Infinite scroll
  useEffect(() => {
    const el = listRef.current;
    if (!el || !hasMore || loading || loadingMore) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
      if (nearBottom) loadConversations(true);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [hasMore, loading, loadingMore, conversations.length, currentSearch]);

  const contactName = (c: Conversation["contact"]) =>
    c.name || c.pushName || c.phoneNumber || c.whatsappId.split("@")[0];

  const isSavedMessages = (c: Conversation["contact"]) =>
    (c.name || c.pushName || "") === "Saved Messages";

  const contactInitial = (c: Conversation["contact"]) => {
    const name = contactName(c);
    return name.charAt(0).toUpperCase() || "?";
  };

  function ContactAvatar({
    contact,
    className = "h-12 w-12",
    active,
  }: {
    contact: Conversation["contact"] | Contact;
    className?: string;
    active?: boolean;
  }) {
    const initial = contactInitial(contact);
    if (contact.profilePicUrl) {
      return (
        <img
          src={contact.profilePicUrl}
          alt=""
          className={`flex-shrink-0 rounded-full object-cover ${className}`}
        />
      );
    }
    return (
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white ${className} ${
          active ? "bg-emerald-600" : "bg-zinc-400 dark:bg-zinc-600"
        }`}
      >
        {initial}
      </div>
    );
  }

  const messagePreview = (m: Conversation["lastMessage"]) =>
    m.body && m.body.length > 50
      ? `${m.body.slice(0, 50)}...`
      : m.body || `[${m.type}]`;

  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-700 flex-shrink-0">
        <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Conversations
        </h2>
        <Input
          type="text"
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Conversation list */}
      <div ref={listRef} className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {error && (
              <div className="m-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
                {error}
              </div>
            )}
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {search ? "No conversations match your search." : "No conversations yet."}
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.contact.id === selectedContactId;
                return (
                  <Link
                    key={conv.contact.id}
                    href={`/dashboard/conversations/${conv.contact.id}`}
                    className={`flex w-full items-center gap-3 border-b border-zinc-100 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 ${
                      isActive
                        ? "bg-emerald-50 hover:bg-emerald-50 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/20"
                        : ""
                    }`}
                  >
                    {/* Avatar */}
                    <ContactAvatar contact={conv.contact} active={isActive} />

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 truncate font-medium text-zinc-900 dark:text-zinc-100">
                          {contactName(conv.contact)}
                          {isSavedMessages(conv.contact) && (
                            <span className="flex-shrink-0 text-zinc-400 dark:text-zinc-500" title="Notes to self">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                              </svg>
                            </span>
                          )}
                        </span>
                        <span className="ml-2 flex-shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                          {formatDistanceToNow(new Date(conv.lastMessage.timestamp), {
                            addSuffix: false,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                          {conv.lastMessage.fromMe && (
                            <span className="text-zinc-400 dark:text-zinc-500">You: </span>
                          )}
                          {messagePreview(conv.lastMessage)}
                        </span>
                        {conv.unreadCount > 0 && (
                          <span className="ml-2 flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-medium text-white">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          {loadingMore && !loading && (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          )}
          {!loading && !loadingMore && hasMore && conversations.length > 0 && (
            <div className="py-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
              Scroll for more
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
