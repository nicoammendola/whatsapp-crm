"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { messagesApi, contactsApi } from "@/lib/api";
import type { Conversation } from "@/lib/api";
import type { Contact } from "@/types";
import { MessageThread } from "@/components/messages/MessageThread";
import { MessageInput } from "@/components/messages/MessageInput";
import { Input } from "@/components/ui/Input";
import { formatDistanceToNow } from "date-fns";

const PAGE_SIZE = 20;

export function ConversationsView({ contactId: urlContactId }: { contactId?: string } = {}) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedContact, setResolvedContact] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const selectedContactId = urlContactId ?? null;

  const loadConversations = useCallback(
    async (append = false) => {
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
    },
    [conversations.length]
  );

  // Initial load
  useEffect(() => {
    loadConversations(false);
  }, []);

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
  }, [hasMore, loading, loadingMore, loadConversations]);

  const contactName = (c: Conversation["contact"]) =>
    c.name || c.pushName || c.phoneNumber || c.whatsappId.split("@")[0];

  const contactInitial = (c: Conversation["contact"]) => {
    const name = contactName(c);
    return name.charAt(0).toUpperCase();
  };

  const messagePreview = (m: Conversation["lastMessage"]) =>
    m.body && m.body.length > 50
      ? `${m.body.slice(0, 50)}...`
      : m.body || `[${m.type}]`;

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = contactName(c.contact).toLowerCase();
    const phone = c.contact.phoneNumber?.toLowerCase() ?? "";
    return name.includes(q) || phone.includes(q);
  });

  // Resolve selected contact: from list or fetch by ID when opened via URL
  const selectedConversation = conversations.find(
    (c) => c.contact.id === selectedContactId
  );

  useEffect(() => {
    if (!urlContactId) {
      setResolvedContact(null);
      return;
    }
    if (selectedConversation) return;
    let cancelled = false;
    contactsApi
      .getById(urlContactId)
      .then((res) => {
        const c = (res.data as { contact?: Contact })?.contact ?? (res.data as Contact);
        if (!cancelled && c) setResolvedContact(c);
      })
      .catch(() => { if (!cancelled) setResolvedContact(null); });
    return () => { cancelled = true; };
  }, [urlContactId, selectedConversation]);

  return (
    <div className="flex h-full w-full overflow-hidden border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      {/* Left panel - conversation list - always visible */}
      <div className="flex min-w-[360px] w-[360px] flex-shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-700">
        {/* Search header */}
        <div className="border-b border-zinc-200 p-3 dark:border-zinc-700">
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
        <div ref={listRef} className="flex-1 overflow-y-auto">
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
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {search ? "No conversations match your search." : "No conversations yet."}
            </div>
          ) : (
            filtered.map((conv) => {
              const isActive = conv.contact.id === selectedContactId;
              return (
                <button
                  key={conv.contact.id}
                  onClick={() => router.push(`/dashboard/conversations/${conv.contact.id}`)}
                  className={`flex w-full items-center gap-3 border-b border-zinc-100 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 ${
                    isActive
                      ? "bg-emerald-50 hover:bg-emerald-50 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/20"
                      : ""
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white ${
                      isActive ? "bg-emerald-600" : "bg-zinc-400 dark:bg-zinc-600"
                    }`}
                  >
                    {contactInitial(conv.contact)}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {contactName(conv.contact)}
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
                </button>
              );
            })
          )}
          {loadingMore && !loading && (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          )}
          {!loading && !loadingMore && hasMore && filtered.length > 0 && !search && (
            <div className="py-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
              Scroll for more
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {/* Right panel - message thread */}
      <div className="flex flex-1 flex-col min-w-0">
        {(selectedConversation || (selectedContactId && resolvedContact)) ? (
          (() => {
            const contact = selectedConversation?.contact ?? resolvedContact!;
            return (
              <>
                {/* Thread header */}
                <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                    {contactInitial(contact)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {contactName(contact)}
                    </h3>
                    {contact.phoneNumber && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {contact.phoneNumber}
                      </p>
                    )}
                  </div>
                </div>
                {/* Message thread */}
                <div className="flex-1 overflow-hidden">
                  <MessageThread
                    key={`${contact.id}-${refreshKey}`}
                    contactId={contact.id}
                    fullHeight
                  />
                </div>
                <MessageInput 
                  contactId={contact.id} 
                  onSent={() => setRefreshKey(k => k + 1)}
                />
              </>
            );
          })()
        ) : selectedContactId ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-zinc-400 dark:text-zinc-500">
            <svg
              className="mb-4 h-16 w-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="mt-1 text-sm">
              Choose a conversation from the list to start reading
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
