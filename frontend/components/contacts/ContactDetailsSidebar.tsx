"use client";

import { useEffect, useState } from "react";
import { contactsApi } from "@/lib/api";
import type { Contact, ContactStats } from "@/types";
import { StatsSection } from "./StatsSection";
import { InfoSection } from "./InfoSection";
import { CustomFieldsSection } from "./CustomFieldsSection";
import { NotesSection } from "./NotesSection";
import { ScheduledMessagesSection } from "./ScheduledMessagesSection";
import { AIInsightsCard } from "./AIInsightsCard";
import { RemindersSection } from "./RemindersSection";
import { TagsSection } from "./TagsSection";

interface ContactDetailsSidebarProps {
  contactId: string;
}

type TabType = "info" | "activity" | "ai" | "scheduled";

export function ContactDetailsSidebar({ contactId }: ContactDetailsSidebarProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("info");
  const [scheduledCount, setScheduledCount] = useState(0);

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
      // Build API-compatible data object. Include fields that are in the update payload
      // even when value is null so the backend can clear them.
      const apiData: {
        notes?: string;
        tags?: string[];
        birthday?: string | null;
        company?: string | null;
        jobTitle?: string | null;
        location?: string | null;
        relationshipType?: string | null;
        contactFrequency?: string | null;
        importance?: number | null;
        customFields?: Record<string, any> | null;
      } = {};

      if ('notes' in data) apiData.notes = data.notes;
      if ('tags' in data) apiData.tags = data.tags;
      if ('birthday' in data) apiData.birthday = data.birthday ?? null;
      if ('company' in data) apiData.company = data.company ?? null;
      if ('jobTitle' in data) apiData.jobTitle = data.jobTitle ?? null;
      if ('location' in data) apiData.location = data.location ?? null;
      if ('relationshipType' in data) apiData.relationshipType = data.relationshipType ?? null;
      if ('contactFrequency' in data) apiData.contactFrequency = data.contactFrequency ?? null;
      if ('importance' in data) apiData.importance = data.importance ?? null;
      if ('customFields' in data) apiData.customFields = data.customFields;

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

  const refetchContact = async () => {
    try {
      const res = await contactsApi.getById(contactId);
      const c = (res.data as { contact?: Contact })?.contact ?? (res.data as Contact);
      setContact(c);
    } catch (err) {
      console.error("Failed to refetch contact:", err);
    }
  };

  const handleScheduledCountChange = (count: number) => {
    setScheduledCount(count);
  };

  const handleAnalysisComplete = async () => {
    await refetchContact();
    // Trigger scheduled messages refresh by switching to scheduled tab and triggering event
    window.dispatchEvent(new CustomEvent("scheduled-message-created", { detail: { contactId } }));
    // Also switch to scheduled tab to show the new suggestion
    setActiveTab("scheduled");
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
    <div className="flex h-full flex-col">
      {/* Tabs */}
      <div className="border-b border-zinc-200 px-4 pt-4 dark:border-zinc-700">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setActiveTab("info")}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === "info"
                ? "border-b-2 border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Info
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === "activity"
                ? "border-b-2 border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Activity
          </button>
          {!contact.isGroup && (
            <button
              onClick={() => setActiveTab("ai")}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "ai"
                  ? "border-b-2 border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              AI Assistant
            </button>
          )}
          <button
            onClick={() => setActiveTab("scheduled")}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === "scheduled"
                ? "border-b-2 border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Scheduled {scheduledCount > 0 && `(${scheduledCount})`}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "info" && (
          <div className="space-y-6">
            <RemindersSection contactId={contactId} />
            <TagsSection contact={contact} onUpdate={handleUpdate} />
            <InfoSection contact={contact} onUpdate={handleUpdate} />
            <CustomFieldsSection contact={contact} onUpdate={handleUpdate} />
            <NotesSection contact={contact} onUpdate={handleUpdate} />
          </div>
        )}
        {activeTab === "activity" && (
          <div>
            <StatsSection stats={stats} />
          </div>
        )}
        {activeTab === "ai" && !contact.isGroup && (
          <div>
            <AIInsightsCard contact={contact} onAnalysisComplete={handleAnalysisComplete} />
          </div>
        )}
        {activeTab === "scheduled" && (
          <div>
            <ScheduledMessagesSection contactId={contactId} onCountChange={handleScheduledCountChange} />
          </div>
        )}
      </div>
    </div>
  );
}
