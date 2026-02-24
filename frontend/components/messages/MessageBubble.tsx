"use client";

import type { Message } from "@/types";
import type { Contact } from "@/types";
import { format } from "date-fns";
import { MessageTextWithMentions } from "./MessageTextWithMentions";

const SENDER_COLORS = [
  "text-[#e15d5d] dark:text-rose-400",
  "text-[#d4880f] dark:text-amber-400",
  "text-[#06966a] dark:text-teal-400",
  "text-[#1fa6c4] dark:text-cyan-400",
  "text-[#8b5cf6] dark:text-violet-400",
  "text-[#d946a8] dark:text-pink-400",
  "text-[#0d7bcc] dark:text-sky-400",
  "text-[#e17c2e] dark:text-orange-400",
];

function senderColorIdx(str: string): number {
  let n = 0;
  for (let i = 0; i < str.length; i++) n = (n << 5) - n + str.charCodeAt(i);
  return Math.abs(n) % SENDER_COLORS.length;
}

const TEMP_ID_PREFIX = "temp-";

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
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-emerald-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-emerald-400 dark:hover:bg-zinc-700"
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
      <svg
        className="h-5 w-5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
      <span className="text-sm font-medium">Poll</span>
    </div>
  );
}

function LinkPreviewCard({
  preview,
  fromMe,
}: {
  preview: NonNullable<Message["linkPreview"]>;
  fromMe: boolean;
}) {
  let domain: string;
  try {
    domain = new URL(preview.url).hostname.replace(/^www\./, "");
  } catch {
    domain = preview.url;
  }

  const hasMeta = preview.title || preview.description;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`-mx-2.5 -mt-1.5 mb-1 block overflow-hidden rounded-t-lg ${
        fromMe
          ? "bg-[#c6e8b8]/40 dark:bg-emerald-900/30"
          : "bg-zinc-100/80 dark:bg-zinc-600/30"
      } transition-opacity hover:opacity-80`}
    >
      {preview.thumbnail && (
        <img
          src={preview.thumbnail}
          alt={preview.title || ""}
          className="w-full object-cover"
          style={{ maxHeight: 200 }}
        />
      )}
      {hasMeta && (
        <div className="px-3 py-2">
          {preview.title && (
            <p className="text-[13px] font-medium leading-snug text-zinc-900 dark:text-zinc-100">
              {preview.title}
            </p>
          )}
          {preview.description && (
            <p className="mt-0.5 line-clamp-3 text-[12px] leading-snug text-zinc-500 dark:text-zinc-400">
              {preview.description}
            </p>
          )}
          <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            <svg
              className="h-3 w-3"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M6.5 9.5a3 3 0 004 .5l2-2a3 3 0 00-4.24-4.24l-1 1" />
              <path d="M9.5 6.5a3 3 0 00-4-.5l-2 2a3 3 0 004.24 4.24l1-1" />
            </svg>
            {domain}
          </p>
        </div>
      )}
    </a>
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
      className={`mb-1.5 rounded border-l-[3px] px-2 py-1 text-xs ${
        fromMe
          ? "border-emerald-600 bg-[#c6e8b8]/50 text-zinc-700 dark:border-emerald-400 dark:bg-emerald-800/30 dark:text-zinc-300"
          : "border-zinc-400 bg-zinc-100/80 text-zinc-600 dark:border-zinc-500 dark:bg-zinc-600/30 dark:text-zinc-300"
      }`}
    >
      <span className="line-clamp-2 break-words">{text}</span>
    </div>
  );
}

function DeliveryStatus({ message }: { message: Message }) {
  if (!message.fromMe) return null;

  if (message.id.startsWith(TEMP_ID_PREFIX)) {
    return (
      <svg
        className="ml-0.5 h-3 w-3 flex-shrink-0 text-[#8696a0] dark:text-zinc-500"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v3.5l2 1" />
      </svg>
    );
  }

  return (
    <svg
      className={`ml-0.5 h-[11px] w-4 flex-shrink-0 ${
        message.isRead
          ? "text-[#53bdeb]"
          : "text-[#8696a0] dark:text-zinc-500"
      }`}
      viewBox="0 0 16 11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 5.5L4.5 9L11 2" />
      <path d="M5 5.5L8.5 9L15 2" />
    </svg>
  );
}

export function MessageBubble({
  message,
  contact,
  showTail = false,
  isLastInGroup = true,
}: {
  message: Message;
  contact?: Contact | null;
  showTail?: boolean;
  isLastInGroup?: boolean;
}) {
  const hasMediaContent = message.hasMedia || message.mediaUrl;
  const body = message.body;
  const hasQuoted = message.quotedContent || message.quotedMessage;
  const isSent = message.fromMe;

  const isGroup = contact?.isGroup;
  const showSender = !isSent && isGroup && showTail;
  const senderLabel =
    message.senderContact?.name ||
    message.senderName ||
    (message.senderPhone
      ? `+${message.senderPhone.replace(/\D/g, "").slice(-10)}`
      : null) ||
    (message.senderJid ? message.senderJid.split("@")[0] : "") ||
    "Unknown";
  const colorIdx = message.senderJid ? senderColorIdx(message.senderJid) : 0;
  const senderTextColor = SENDER_COLORS[colorIdx];

  const hasReactions = message.reactions && message.reactions.length > 0;
  const canInlineTimestamp =
    !!body && !hasReactions;
  const spacerWidth =
    16 + 30 + (message.isEdited ? 45 : 0) + (isSent ? 24 : 0);

  const bubbleRounding = isSent
    ? showTail
      ? "rounded-lg rounded-tr-[3px]"
      : "rounded-lg"
    : showTail
      ? "rounded-lg rounded-tl-[3px]"
      : "rounded-lg";

  const bubbleColors = isSent
    ? "bg-[#d9fdd3] text-zinc-900 dark:bg-[#005c4b] dark:text-zinc-100"
    : "bg-white text-zinc-900 dark:bg-[#202c33] dark:text-zinc-100";

  return (
    <div
      className={`flex ${isSent ? "justify-end" : "justify-start"} ${
        isLastInGroup ? "mb-2" : "mb-[3px]"
      }`}
    >
      <div
        className={`flex max-w-[75%] flex-col ${
          isSent ? "items-end" : "items-start"
        }`}
      >
        <div
          className={`relative ${bubbleRounding} ${bubbleColors} px-2.5 py-1.5 shadow-sm`}
        >
          {showTail && isSent && (
            <span className="absolute -right-[8px] top-0 block text-[#d9fdd3] dark:text-[#005c4b]">
              <svg width="8" height="13" viewBox="0 0 8 13">
                <path d="M0 0v11C1 7 4 4 8 0H0z" fill="currentColor" />
              </svg>
            </span>
          )}
          {showTail && !isSent && (
            <span className="absolute -left-[8px] top-0 block text-white dark:text-[#202c33]">
              <svg width="8" height="13" viewBox="0 0 8 13">
                <path d="M8 0v11C7 7 4 4 0 0h8z" fill="currentColor" />
              </svg>
            </span>
          )}

          {showSender && (
            <p
              className={`text-[13px] font-medium leading-snug ${senderTextColor}`}
            >
              {senderLabel}
            </p>
          )}

          {message.linkPreview && (
            <LinkPreviewCard preview={message.linkPreview} fromMe={isSent} />
          )}

          {hasQuoted && (
            <QuotedBlock
              quotedContent={message.quotedContent}
              quotedMessage={message.quotedMessage}
              fromMe={isSent}
            />
          )}
          {message.type === "POLL" && <PollContent message={message} />}
          {hasMediaContent && message.type !== "POLL" && (
            <MediaContent message={message} />
          )}
          {canInlineTimestamp ? (
            <div className="relative">
              <MessageTextWithMentions
                body={body!}
                mentions={message.mentions}
                fromMe={isSent}
                suffix={
                  <span
                    className="inline-block select-none"
                    style={{ width: spacerWidth, height: 0 }}
                    aria-hidden="true"
                  />
                }
              />
              <span className="absolute bottom-[2px] right-0 flex items-center gap-1.5">
                <span className="text-[11px] leading-none text-[#667781] dark:text-zinc-400">
                  {format(new Date(message.timestamp), "HH:mm")}
                  {message.isEdited && (
                    <span className="ml-0.5 opacity-80" title="Edited">
                      (edited)
                    </span>
                  )}
                </span>
                {isSent && <DeliveryStatus message={message} />}
              </span>
            </div>
          ) : (
            <>
              {body && (
                <MessageTextWithMentions
                  body={body}
                  mentions={message.mentions}
                  fromMe={isSent}
                />
              )}
              {!body && !hasMediaContent && message.type !== "POLL" && (
                <p className="whitespace-pre-wrap break-words text-sm italic opacity-70">
                  {hasQuoted ? "\u2014" : "(empty)"}
                </p>
              )}
              <div className="mt-0.5 flex min-h-[14px] items-center justify-end gap-1.5 flex-wrap">
                {hasReactions && (
                  <div className="-ml-1 flex flex-wrap gap-0.5 rounded-full bg-black/5 px-1.5 py-0.5 dark:bg-white/10">
                    {message.reactions!.map((r, i) => (
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
                <span className="text-[11px] leading-none text-[#667781] dark:text-zinc-400">
                  {format(new Date(message.timestamp), "HH:mm")}
                  {message.isEdited && (
                    <span className="ml-0.5 opacity-80" title="Edited">
                      (edited)
                    </span>
                  )}
                </span>
                {isSent && <DeliveryStatus message={message} />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
