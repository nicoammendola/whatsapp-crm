"use client";

import { useEffect, useState, useCallback } from "react";
import { messagesApi } from "@/lib/api";
import type { Conversation } from "@/lib/api";
import { MessageThread } from "@/components/messages/MessageThread";
import { Input } from "@/components/ui/Input";
import { formatDistanceToNow } from "date-fns";

export function ConversationsView() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadConversations = useCallback(async () => {
    try {
      setError(null);
      const { data } = await messagesApi.getConversations();
      setConversations(data.conversations ?? []);
    } catch {
      setError("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    // Poll every 10 seconds for new conversations
    const id = setInterval(loadConversations, 10_000);
    return () => clearInterval(id);
  }, [loadConversations]);

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

  const selectedConversation = conversations.find(
    (c) => c.contact.id === selectedContactId
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-80px)] max-w-7xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {/* Left panel - conversation list */}
      <div className="flex w-[360px] flex-shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-700">
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
        <div className="flex-1 overflow-y-auto">
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
                  onClick={() => setSelectedContactId(conv.contact.id)}
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
        </div>
      </div>

      {/* Right panel - message thread */}
      <div className="flex flex-1 flex-col">
        {selectedConversation ? (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                {contactInitial(selectedConversation.contact)}
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {contactName(selectedConversation.contact)}
                </h3>
                {selectedConversation.contact.phoneNumber && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {selectedConversation.contact.phoneNumber}
                  </p>
                )}
              </div>
            </div>
            {/* Message thread */}
            <div className="flex-1 overflow-hidden p-4">
              <MessageThread
                contactId={selectedConversation.contact.id}
                fullHeight
              />
            </div>
          </>
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
