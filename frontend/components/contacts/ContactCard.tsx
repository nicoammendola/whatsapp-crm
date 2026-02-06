"use client";

import Link from "next/link";
import type { Contact } from "@/types";
import { Card, CardContent } from "@/components/ui/Card";
import { formatDistanceToNow } from "date-fns";

export function ContactCard({ contact }: { contact: Contact }) {
  const name = contact.name || contact.pushName || contact.phoneNumber || contact.whatsappId.split("@")[0];

  return (
    <Link href={`/dashboard/conversations/${contact.id}`}>
      <Card className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
        <CardContent className="flex items-center gap-4 py-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {name}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {contact.lastInteraction
                ? `Last contact ${formatDistanceToNow(new Date(contact.lastInteraction), { addSuffix: true })}`
                : "No messages yet"}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
