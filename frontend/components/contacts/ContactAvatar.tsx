"use client";

import { useEffect, useRef, useState } from "react";
import { contactsApi } from "@/lib/api";

/** Minimal contact shape for avatar (id + profilePicUrl + name/pushName/phoneNumber for fallback initial). */
export type ContactAvatarContact = {
  id: string;
  profilePicUrl: string | null;
  name?: string | null;
  pushName?: string | null;
  phoneNumber?: string | null;
  whatsappId?: string;
};

function getInitial(contact: ContactAvatarContact): string {
  const name =
    contact.name ||
    contact.pushName ||
    (contact.phoneNumber ?? contact.whatsappId?.split("@")[0]) ||
    "?";
  return name.charAt(0).toUpperCase();
}

interface ContactAvatarProps {
  contact: ContactAvatarContact;
  className?: string;
  /** For list styling (e.g. active conversation). */
  active?: boolean;
  /** Called when profile pic failed to load and a new URL was fetched. Use to update parent state. */
  onRefresh?: (newUrl: string | null) => void;
}

/**
 * Renders contact avatar (profile picture or initial).
 * On image load error (e.g. WhatsApp "URL signature expired"), triggers a refresh
 * and optionally notifies the parent via onRefresh so the new URL can be used.
 */
export function ContactAvatar({
  contact,
  className = "h-12 w-12",
  active,
  onRefresh,
}: ContactAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const refreshStarted = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (contact.profilePicUrl) {
      setImageFailed(false);
      refreshStarted.current = false;
      return;
    }
    if (refreshStarted.current) return;
    refreshStarted.current = true;
    contactsApi
      .refreshProfilePicture(contact.id)
      .then(({ data }) => {
        if (data.profilePicUrl) {
          onRefreshRef.current?.(data.profilePicUrl);
        }
      })
      .catch(() => {})
      .finally(() => {
        refreshStarted.current = false;
      });
  }, [contact.id, contact.profilePicUrl]);

  const initial = getInitial(contact);
  const showImage =
    contact.profilePicUrl && !imageFailed;

  const handleError = () => {
    setImageFailed(true);
    if (refreshStarted.current) return;
    refreshStarted.current = true;
    contactsApi
      .refreshProfilePicture(contact.id)
      .then(({ data }) => {
        onRefresh?.(data.profilePicUrl ?? null);
      })
      .catch(() => {})
      .finally(() => {
        refreshStarted.current = false;
      });
  };

  if (showImage) {
    return (
      <img
        src={contact.profilePicUrl!}
        alt=""
        className={`flex-shrink-0 rounded-full object-cover ${className}`}
        onError={handleError}
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
