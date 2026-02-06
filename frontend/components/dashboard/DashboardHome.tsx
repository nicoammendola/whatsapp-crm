"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { analyticsApi, contactsApi, messagesApi } from "@/lib/api";
import type { Contact, Message } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDistanceToNow } from "date-fns";

export function DashboardHome() {
  const [needsAttention, setNeedsAttention] = useState<Contact[]>([]);
  const [pendingReplies, setPendingReplies] = useState<Contact[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const [attentionRes, pendingRes, messagesRes] = await Promise.all([
          analyticsApi.getContactsNeedingAttention(),
          analyticsApi.getPendingReplies(),
          messagesApi.getAll({ limit: 15 }),
        ]);
        if (cancelled) return;
        setNeedsAttention(attentionRes.data?.contacts ?? []);
        setPendingReplies(pendingRes.data?.contacts ?? []);
        setRecentMessages(messagesRes.data?.messages ?? []);
      } catch (e) {
        if (!cancelled) {
          setError("Failed to load dashboard data");
          const [contactsRes, messagesRes] = await Promise.all([
            contactsApi.getAll().catch(() => ({ data: { contacts: [] } })),
            messagesApi.getAll({ limit: 15 }).catch(() => ({ data: { messages: [] } })),
          ]);
          setNeedsAttention(contactsRes.data?.contacts?.slice(0, 5) ?? []);
          setRecentMessages(messagesRes.data?.messages ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const contactName = (c: Contact) => c.name || c.pushName || c.phoneNumber || c.whatsappId.split("@")[0];
  const messagePreview = (m: Message) => (m.body && m.body.length > 60 ? `${m.body.slice(0, 60)}…` : m.body) || "(media)";

  // Group messages by contact — keep only the latest message per contact
  const recentConversations = (() => {
    const byContact = new Map<string, Message>();
    for (const m of recentMessages) {
      if (!byContact.has(m.contactId)) {
        byContact.set(m.contactId, m);
      }
    }
    return Array.from(byContact.values());
  })();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Dashboard
      </h1>
      {error && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          {error} — showing available data.
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Need to reach out</CardTitle>
          </CardHeader>
          <CardContent>
            {needsAttention.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No contacts flagged. Connect WhatsApp and sync contacts to see insights.
              </p>
            ) : (
              <ul className="space-y-2">
                {needsAttention.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/dashboard/conversations/${c.id}`}
                      className="text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      {contactName(c)}
                    </Link>
                    {c.lastInteraction && (
                      <span className="ml-2 text-xs text-zinc-500">
                        {formatDistanceToNow(new Date(c.lastInteraction), { addSuffix: true })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending replies</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingReplies.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No pending replies.
              </p>
            ) : (
              <ul className="space-y-2">
                {pendingReplies.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/dashboard/conversations/${c.id}`}
                      className="text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      {contactName(c)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent conversations</CardTitle>
        </CardHeader>
        <CardContent>
          {recentConversations.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No messages yet. Connect WhatsApp in Settings to sync.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentConversations.slice(0, 10).map((m) => (
                <li key={m.contactId} className="flex flex-col gap-0.5">
                  <Link
                    href={`/dashboard/conversations/${m.contactId}`}
                    className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    {m.contact?.name || m.contact?.pushName || m.contactId}
                  </Link>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {messagePreview(m)} · {formatDistanceToNow(new Date(m.timestamp), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
