"use client";

import type { Message } from "@/types";
import type { Contact } from "@/types";
import { format } from "date-fns";
import { MessageTextWithMentions } from "./MessageTextWithMentions";

function hashToColor(str: string): string {
  let n = 0;
  for (let i = 0; i < str.length; i++) n = (n << 5) - n + str.charCodeAt(i);
  const colors = [
    "bg-rose-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-cyan-500",
    "bg-violet-500",
    "bg-pink-500",
    "bg-sky-500",
    "bg-orange-500",
  ];
  return colors[Math.abs(n) % colors.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  return name.charAt(0).toUpperCase() || "?";
}

function MediaContent({ message }: { message: Message }) {
  const { type, mediaUrl, body, hasMedia } = message;

  if (!hasMedia && !mediaUrl) return null;

  if (type === "IMAGE" && mediaUrl) {
    return (
      <div className="mb-1">
        <img
          src={mediaUrl}
          alt={body || "Image"}
          className="max-w-full rounded-lg"
          loading="lazy"
          style={{ maxHeight: 300 }}
        />
      </div>
    );
  }

  if (type === "VIDEO" && mediaUrl) {
    return (
      <div className="mb-1">
        <video
          src={mediaUrl}
          controls
          className="max-w-full rounded-lg"
          style={{ maxHeight: 300 }}
          preload="metadata"
        />
      </div>
    );
  }

  if (type === "AUDIO" && mediaUrl) {
    return (
      <div className="mb-1">
        <audio src={mediaUrl} controls className="w-full" preload="metadata" />
      </div>
    );
  }

  if (type === "DOCUMENT" && mediaUrl) {
    return (
      <div className="mb-1">
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-emerald-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-emerald-400 dark:hover:bg-zinc-700"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Download document
        </a>
      </div>
    );
  }

  if (type === "STICKER" && mediaUrl) {
    return (
      <div className="mb-1">
        <img
          src={mediaUrl}
          alt="Sticker"
          className="h-32 w-32"
          loading="lazy"
        />
      </div>
    );
  }

  // Fallback for media without URL (not yet downloaded or unsupported)
  if (hasMedia && !mediaUrl) {
    const labels: Record<string, string> = {
      IMAGE: "Photo",
      VIDEO: "Video",
      AUDIO: "Voice message",
      DOCUMENT: "Document",
      STICKER: "Sticker",
      LOCATION: "Location",
      CONTACT: "Contact card",
      POLL: "Poll",
    };
    return (
      <span className="text-xs italic opacity-70">
        [{labels[type] || "Media"}]
      </span>
    );
  }

  return null;
}

function PollContent({ message }: { message: Message }) {
  if (message.type !== "POLL") return null;
  
  return (
    <div className="flex items-center gap-2">
      <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
      <span className="text-sm font-medium">Poll</span>
    </div>
  );
}

function QuotedBlock({
  quotedContent,
  quotedMessage,
  fromMe,
}: {
  quotedContent?: string | null;
  quotedMessage?: Message | null;
  fromMe: boolean;
}) {
  const text =
    quotedContent ??
    (quotedMessage?.body && quotedMessage.body.length > 0
      ? quotedMessage.body
      : quotedMessage
        ? "[Media]"
        : null);
  if (!text) return null;
  return (
    <div
      className={`mb-2 border-l-2 pl-2 text-xs ${
        fromMe
          ? "border-emerald-200 text-emerald-100"
          : "border-zinc-300 text-zinc-500 dark:border-zinc-500 dark:text-zinc-400"
      }`}
    >
      <span className="font-medium opacity-90">Replying to </span>
      <span className="line-clamp-2 break-words opacity-90">{text}</span>
    </div>
  );
}

export function MessageBubble({
  message,
  contact,
}: {
  message: Message;
  contact?: Contact | null;
}) {
  const hasMediaContent = message.hasMedia || message.mediaUrl;
  const body = message.body;
  const hasQuoted = message.quotedContent || message.quotedMessage;
  const showSender =
    (contact?.isGroup || message.senderJid || message.senderName) &&
    !message.fromMe &&
    (message.senderName || message.senderJid);
  const senderLabel =
    message.senderName ||
    (message.senderPhone ? `+${message.senderPhone.replace(/\D/g, "").slice(-10)}` : null) ||
    (message.senderJid ? message.senderJid.split("@")[0] : "") ||
    "Unknown";
  const senderColor = message.senderJid
    ? hashToColor(message.senderJid)
    : "bg-zinc-500";

  return (
    <div
      className={`mb-2 flex ${message.fromMe ? "justify-end" : "justify-start"}`}
    >
      <div className="flex max-w-[75%] flex-col items-end">
        {showSender && (
          <div className="mb-0.5 flex items-center gap-1.5">
            <div
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white ${senderColor}`}
              title={senderLabel}
            >
              {initials(senderLabel)}
            </div>
            <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {senderLabel}
            </span>
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2 ${
            message.fromMe
              ? "bg-emerald-600 text-white"
              : "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
          }`}
        >
          {hasQuoted && (
            <QuotedBlock
              quotedContent={message.quotedContent}
              quotedMessage={message.quotedMessage}
              fromMe={message.fromMe}
            />
          )}
          {message.type === "POLL" && <PollContent message={message} />}
          {hasMediaContent && message.type !== "POLL" && <MediaContent message={message} />}
          {body && (
            <MessageTextWithMentions
              body={body}
              mentions={message.mentions}
              fromMe={message.fromMe}
            />
          )}
          {!body && !hasMediaContent && message.type !== "POLL" && (
            <p className="whitespace-pre-wrap break-words text-sm italic opacity-70">
              {hasQuoted ? "—" : "(empty)"}
            </p>
          )}

          {/* Time & Reactions Footer */}
          <div className="mt-1 flex items-center justify-end gap-2 flex-wrap min-h-[1.25rem]">
            {message.reactions && message.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 bg-black/10 dark:bg-white/10 rounded-full px-1.5 py-0.5 -ml-1">
                {message.reactions.map((r, i) => (
                  <span
                    key={`${r.emoji}-${r.fromMe}-${i}`}
                    className="text-xs leading-none"
                    title={r.fromMe ? "You" : undefined}
                  >
                    {r.emoji}
                  </span>
                ))}
              </div>
            )}
            <span
                className={`text-xs ${
                message.fromMe
                    ? "text-emerald-100"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
            >
                {format(new Date(message.timestamp), "HH:mm")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
