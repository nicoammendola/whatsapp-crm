"use client";

import type { Message } from "@/types";
import { format } from "date-fns";

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
    };
    return (
      <span className="text-xs italic opacity-70">
        [{labels[type] || "Media"}]
      </span>
    );
  }

  return null;
}

export function MessageBubble({ message }: { message: Message }) {
  const hasMediaContent = message.hasMedia || message.mediaUrl;
  const body = message.body;

  return (
    <div
      className={`mb-2 flex ${message.fromMe ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          message.fromMe
            ? "bg-emerald-600 text-white"
            : "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
        }`}
      >
        {hasMediaContent && <MediaContent message={message} />}
        {body && (
          <p className="whitespace-pre-wrap break-words text-sm">{body}</p>
        )}
        {!body && !hasMediaContent && (
          <p className="whitespace-pre-wrap break-words text-sm italic opacity-70">
            (empty)
          </p>
        )}
        <span
          className={`mt-1 block text-xs ${
            message.fromMe
              ? "text-emerald-100"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {format(new Date(message.timestamp), "HH:mm")}
        </span>
      </div>
    </div>
  );
}
