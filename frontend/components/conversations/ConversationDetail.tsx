"use client";

import { useEffect, useState } from "react";
import { contactsApi } from "@/lib/api";
import type { Contact } from "@/types";
import { MessageThread } from "@/components/messages/MessageThread";

function contactName(c: Contact) {
  return c.name || c.pushName || c.phoneNumber || c.whatsappId.split("@")[0];
}

function isSavedMessages(c: Contact) {
  return (c.name || c.pushName || "") === "Saved Messages";
}

function contactInitial(c: Contact) {
  const name = contactName(c);
  return name.charAt(0).toUpperCase() || "?";
}

function ContactAvatar({
  contact,
  className = "h-12 w-12",
}: {
  contact: Contact;
  className?: string;
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
      className={`flex flex-shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white bg-zinc-400 dark:bg-zinc-600 ${className}`}
    >
      {initial}
    </div>
  );
}

export function ConversationDetail({ 
  contactId, 
  onToggleSidebar,
  onToggleSidebarDesktop,
  sidebarVisible
}: { 
  contactId: string;
  onToggleSidebar?: () => void;
  onToggleSidebarDesktop?: () => void;
  sidebarVisible?: boolean;
}) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    contactsApi
      .getById(contactId)
      .then((res) => {
        const c = (res.data as { contact?: Contact })?.contact ?? (res.data as Contact);
        if (!cancelled && c) {
          setContact(c);
          // Try to refresh profile pic if missing
          if (!c.profilePicUrl) {
            contactsApi.refreshProfilePicture(contactId).then(({ data }) => {
               if (data.profilePicUrl && !cancelled) {
                   setContact(prev => prev ? { ...prev, profilePicUrl: data.profilePicUrl } : prev);
               }
            }).catch(() => {});
          }
        }
      })
      .catch(() => {
        // error handling
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-white dark:bg-zinc-900">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-white dark:bg-zinc-900 text-zinc-500">
        Contact not found
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-900">
      {/* Thread header */}
      <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
        <ContactAvatar contact={contact} className="h-10 w-10 text-sm" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            {contactName(contact)}
          </h3>
          {isSavedMessages(contact) ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Notes to self
            </p>
          ) : contact.phoneNumber ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {contact.phoneNumber}
            </p>
          ) : null}
        </div>
        
        {/* Toggle sidebar button for mobile */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="lg:hidden rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="Show contact details"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        )}
        
        {/* Toggle sidebar button for desktop */}
        {onToggleSidebarDesktop && (
          <button
            onClick={onToggleSidebarDesktop}
            className="hidden lg:flex rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title={`${sidebarVisible ? "Hide" : "Show"} contact details (Cmd+I)`}
          >
            {sidebarVisible ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            )}
          </button>
        )}
      </div>
      {/* Message thread (includes MessageInput) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <MessageThread
          key={contact.id}
          contactId={contact.id}
          contact={contact}
          fullHeight
        />
      </div>
    </div>
  );
}
