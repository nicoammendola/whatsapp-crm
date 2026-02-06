"use client";

import { useEffect, useState } from "react";
import { contactsApi } from "@/lib/api";
import type { Contact } from "@/types";
import { Card, CardContent } from "@/components/ui/Card";
import { ContactCard } from "./ContactCard";
export function ContactList() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    contactsApi
      .getAll()
      .then((res) => {
        if (!cancelled) setContacts(res.data?.contacts ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load contacts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = (c: Contact) =>
    c.name || c.pushName || c.phoneNumber || c.whatsappId.split("@")[0];
  const filtered = search.trim()
    ? contacts.filter(
        (c) =>
          displayName(c).toLowerCase().includes(search.toLowerCase()) ||
          (c.phoneNumber ?? "").includes(search) ||
          c.whatsappId.toLowerCase().includes(search.toLowerCase())
      )
    : contacts;

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/30 dark:text-red-200">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="search"
        placeholder="Search contacts…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
      />
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-zinc-500 dark:text-zinc-400">
            {contacts.length === 0
              ? "No contacts yet. Connect WhatsApp in Settings to sync."
              : "No contacts match your search."}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <ContactCard contact={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
