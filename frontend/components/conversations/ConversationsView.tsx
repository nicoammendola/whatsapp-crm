"use client";

import { useEffect, useState } from "react";
import { contactsApi } from "@/lib/api";
import type { Contact } from "@/types";
import { MessageThread } from "@/components/messages/MessageThread";
import { ConversationList } from "@/components/conversations/ConversationList";

export function ConversationsView({ contactId: urlContactId }: { contactId?: string } = {}) {
  const [resolvedContact, setResolvedContact] = useState<Contact | null>(null);

  const selectedContactId = urlContactId ?? null;

  const contactName = (c: Contact) =>
    c.name || c.pushName || c.phoneNumber || c.whatsappId.split("@")[0];

  const isSavedMessages = (c: Contact) =>
    (c.name || c.pushName || "") === "Saved Messages";

  const contactInitial = (c: Contact) => {
    const name = contactName(c);
    return name.charAt(0).toUpperCase() || "?";
  };

  function ContactAvatar({
    contact,
    className = "h-12 w-12",
    active,
  }: {
    contact: Contact;
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

  // Fetch contact by ID when opened via URL
  useEffect(() => {
    if (!urlContactId) {
      setResolvedContact(null);
      return;
    }
    let cancelled = false;
    contactsApi
      .getById(urlContactId)
      .then((res) => {
        const c = (res.data as { contact?: Contact })?.contact ?? (res.data as Contact);
        if (!cancelled && c) setResolvedContact(c);
      })
      .catch(() => { if (!cancelled) setResolvedContact(null); });
    return () => { cancelled = true; };
  }, [urlContactId]);

  return (
    <div className="flex h-full w-full overflow-hidden border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      {/* Left panel - conversation list */}
      <ConversationList selectedContactId={selectedContactId} />

      {/* Right panel - message thread */}
      <div className="flex flex-1 flex-col min-w-0">
        {(selectedContactId && resolvedContact) ? (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
              <ContactAvatar contact={resolvedContact} className="h-10 w-10 text-sm" active />
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {contactName(resolvedContact)}
                </h3>
                {isSavedMessages(resolvedContact) ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Notes to self
                  </p>
                ) : resolvedContact.phoneNumber ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {resolvedContact.phoneNumber}
                  </p>
                ) : null}
              </div>
            </div>
            {/* Message thread (includes MessageInput) */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <MessageThread
                key={resolvedContact.id}
                contactId={resolvedContact.id}
                contact={resolvedContact}
                fullHeight
              />
            </div>
          </>
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
