"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { messagesApi, whatsappApi } from "@/lib/api";
import { useSocket } from "@/lib/socket";
import type { Conversation } from "@/lib/api";
import type { Contact } from "@/types";
import { ContactAvatar } from "@/components/contacts/ContactAvatar";
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
  const [syncing, setSyncing] = useState(false);
  const [messageSyncing, setMessageSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncedSearchRef = useRef<string>(""); // Track which searches we've already synced for
  const messageSyncingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const socket = useSocket();

  const loadConversations = async (append: boolean, skipSync = false, silent = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    
    const offset = append ? conversations.length : 0;
    if (append) setLoadingMore(true);
    else if (!silent) setLoading(true);
    else setRefreshing(true);
    
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

      // If search returned no results and we haven't synced for this search yet, trigger sync
      if (!skipSync && !append && currentSearch && list.length === 0 && syncedSearchRef.current !== currentSearch) {
        syncedSearchRef.current = currentSearch;
        setSyncing(true);
        
        try {
          // Try to search and sync the contact by name or phone number
          const searchTrimmed = currentSearch.trim();
          
          // Check if search looks like a phone number (mostly digits, at least 7 digits)
          const digitsOnly = searchTrimmed.replace(/\D/g, '');
          const isPhoneNumber = digitsOnly.length >= 7 && digitsOnly.length <= 15;
          
          let phoneNumber: string | undefined;
          let name: string | undefined;
          
          if (isPhoneNumber) {
            // Search looks like a phone number
            phoneNumber = digitsOnly;
            // Try to extract name if there are non-digit characters
            const namePart = searchTrimmed.replace(/\d/g, '').trim();
            name = namePart || undefined;
          } else {
            // Search looks like a name, but check if it contains a phone number
            const phoneMatch = searchTrimmed.match(/\d{7,15}/);
            if (phoneMatch) {
              phoneNumber = phoneMatch[0];
              name = searchTrimmed.replace(phoneMatch[0], '').trim() || undefined;
            } else {
              name = searchTrimmed;
            }
          }
          
          if (phoneNumber || name) {
            await whatsappApi.searchAndSyncContact({
              phoneNumber: phoneNumber || undefined,
              name: name || undefined,
            });
            
            // Wait a bit for sync to complete, then retry search
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Retry the search
            const { data: retryData } = await messagesApi.getConversations({
              limit: PAGE_SIZE,
              offset: 0,
              search: currentSearch || undefined,
            });
            const retryList = retryData.conversations ?? [];
            setHasMore(retryData.hasMore ?? false);
            setConversations(retryList);
          } else {
            // If no phone or name, just sync all contacts
            await whatsappApi.syncContacts();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Retry the search
            const { data: retryData } = await messagesApi.getConversations({
              limit: PAGE_SIZE,
              offset: 0,
              search: currentSearch || undefined,
            });
            const retryList = retryData.conversations ?? [];
            setHasMore(retryData.hasMore ?? false);
            setConversations(retryList);
          }
        } catch (syncError) {
          console.error('Sync error:', syncError);
          // Don't show error to user, just continue
        } finally {
          setSyncing(false);
        }
      }
    } catch {
      setError("Failed to load conversations");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      loadingRef.current = false;
    }
  };

  // Initial load
  useEffect(() => {
    // Reset synced search ref when search changes
    if (syncedSearchRef.current !== currentSearch) {
      syncedSearchRef.current = "";
    }
    loadConversations(false);
  }, [currentSearch]);

  // Listen for new messages and sync events via socket
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = () => {
      if (loadingRef.current) return;

      if (messageSyncingRef.current) {
        // Bulk sync mode: debounce — reset 2s timer on each message,
        // only refetch once the burst stops
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          loadConversations(false, true, true);
        }, 2000);
      } else {
        // Normal mode: silent background refresh (no loading spinner)
        loadConversations(false, true, true);
      }
    };

    const handleSyncStarted = () => {
      messageSyncingRef.current = true;
      setMessageSyncing(true);
    };

    const handleSyncComplete = () => {
      messageSyncingRef.current = false;
      setMessageSyncing(false);
      // Clear any pending debounce and do a final refresh
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      loadConversations(false, true, true);
    };

    socket.on("new_message", handleNewMessage);
    socket.on("whatsapp_sync_started", handleSyncStarted);
    socket.on("whatsapp_sync_complete", handleSyncComplete);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("whatsapp_sync_started", handleSyncStarted);
      socket.off("whatsapp_sync_complete", handleSyncComplete);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [socket]);

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

  const handleAvatarRefresh = (contactId: string, profilePicUrl: string | null) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.contact.id === contactId
          ? { ...c, contact: { ...c.contact, profilePicUrl } }
          : c
      )
    );
  };

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

      {/* Sync / refresh indicators */}
      {messageSyncing && (
        <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300 flex-shrink-0">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Syncing messages…
        </div>
      )}
      {refreshing && !messageSyncing && (
        <div className="h-0.5 flex-shrink-0 overflow-hidden">
          <div className="h-full w-full animate-pulse bg-emerald-400/60 dark:bg-emerald-500/40" />
        </div>
      )}

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
                {syncing ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    <span>Syncing contacts...</span>
                  </div>
                ) : search ? (
                  "No conversations match your search."
                ) : (
                  "No conversations yet."
                )}
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.contact.id === selectedContactId;
                return (
                  <Link
                    key={conv.contact.id}
                    href={`/dashboard/conversations/${conv.contact.id}`}
                    className={`flex w-full items-center gap-3 border-b border-zinc-100 px-4 py-3 text-left transition-all duration-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 ${
                      isActive
                        ? "bg-emerald-50 hover:bg-emerald-50 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/20"
                        : ""
                    }`}
                  >
                    {/* Avatar */}
                    <ContactAvatar
                      contact={conv.contact}
                      active={isActive}
                      onRefresh={(profilePicUrl) =>
                        handleAvatarRefresh(conv.contact.id, profilePicUrl)
                      }
                    />

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
