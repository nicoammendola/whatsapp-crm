"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { contactsApi } from "@/lib/api";
import type { Contact } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MessageThread } from "@/components/messages/MessageThread";

export function ContactDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    params.then((p) => {
      const id = p.id;
      if (cancelled) return;
      setResolvedId(id);
      contactsApi
        .getById(id)
        .then((res) => {
          if (!cancelled) setContact((res.data as { contact?: Contact })?.contact ?? res.data as Contact);
        })
        .catch(() => {
          if (!cancelled) setError("Contact not found");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  if (loading || !resolvedId) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          ← Back
        </Button>
        <div className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error ?? "Contact not found"}
        </div>
      </div>
    );
  }

  const name = contact.name || contact.pushName || contact.phoneNumber || contact.whatsappId.split("@")[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/contacts"
          className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ← Contacts
        </Link>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xl font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <CardTitle>{name}</CardTitle>
            {contact.phoneNumber && (
              <p className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                {contact.phoneNumber}
              </p>
            )}
            {contact.notes && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {contact.notes}
              </p>
            )}
          </div>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent>
          <MessageThread contactId={contact.id} />
        </CardContent>
      </Card>
    </div>
  );
}
