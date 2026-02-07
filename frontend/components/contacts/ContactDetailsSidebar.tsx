"use client";

import { useEffect, useState } from "react";
import { contactsApi } from "@/lib/api";
import type { Contact, ContactStats } from "@/types";
import { ContactHeader } from "./ContactHeader";
import { StatsSection } from "./StatsSection";
import { InfoSection } from "./InfoSection";
import { CustomFieldsSection } from "./CustomFieldsSection";
import { NotesSection } from "./NotesSection";

interface ContactDetailsSidebarProps {
  contactId: string;
}

export function ContactDetailsSidebar({ contactId }: ContactDetailsSidebarProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch contact + stats on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      contactsApi.getById(contactId),
      contactsApi.getStats(contactId),
    ])
      .then(([contactRes, statsRes]) => {
        if (cancelled) return;
        const c = (contactRes.data as { contact?: Contact })?.contact ?? (contactRes.data as Contact);
        setContact(c);
        setStats(statsRes.data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load contact details:", err);
        setError("Failed to load contact details");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const handleUpdate = async (data: Partial<Contact>) => {
    if (!contact) return;

    // Optimistic update
    setContact((prev) => (prev ? { ...prev, ...data } : prev));

    try {
      // Build API-compatible data object, filtering out null values
      const apiData: {
        notes?: string;
        tags?: string[];
        birthday?: string;
        company?: string;
        jobTitle?: string;
        location?: string;
        relationshipType?: string;
        contactFrequency?: string;
        importance?: number;
        customFields?: Record<string, any>;
      } = {};

      if (data.notes !== null && data.notes !== undefined) apiData.notes = data.notes;
      if (data.tags !== null && data.tags !== undefined) apiData.tags = data.tags;
      if (data.birthday !== null && data.birthday !== undefined) apiData.birthday = data.birthday;
      if (data.company !== null && data.company !== undefined) apiData.company = data.company;
      if (data.jobTitle !== null && data.jobTitle !== undefined) apiData.jobTitle = data.jobTitle;
      if (data.location !== null && data.location !== undefined) apiData.location = data.location;
      if (data.relationshipType !== null && data.relationshipType !== undefined) apiData.relationshipType = data.relationshipType;
      if (data.contactFrequency !== null && data.contactFrequency !== undefined) apiData.contactFrequency = data.contactFrequency;
      if (data.importance !== null && data.importance !== undefined) apiData.importance = data.importance;
      if (data.customFields !== null && data.customFields !== undefined) apiData.customFields = data.customFields;

      await contactsApi.update(contactId, apiData);
      // Refetch to get server state
      const res = await contactsApi.getById(contactId);
      const c = (res.data as { contact?: Contact })?.contact ?? (res.data as Contact);
      setContact(c);
    } catch (err) {
      console.error("Failed to update contact:", err);
      // Revert optimistic update on error
      const res = await contactsApi.getById(contactId);
      const c = (res.data as { contact?: Contact })?.contact ?? (res.data as Contact);
      setContact(c);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          {error || "Contact not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <ContactHeader contact={contact} onUpdate={handleUpdate} />
      <StatsSection stats={stats} />
      <InfoSection contact={contact} onUpdate={handleUpdate} />
      <CustomFieldsSection contact={contact} onUpdate={handleUpdate} />
      <NotesSection contact={contact} onUpdate={handleUpdate} />
    </div>
  );
}
