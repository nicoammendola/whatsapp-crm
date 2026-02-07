"use client";

import { parseMessageWithMentions, type MentionInfo } from "@/lib/mentions";

interface MessageTextWithMentionsProps {
  body: string;
  mentions?: MentionInfo[];
  fromMe: boolean;
}

export function MessageTextWithMentions({
  body,
  mentions = [],
  fromMe,
}: MessageTextWithMentionsProps) {
  // If no mentions, just render plain text
  if (!mentions || mentions.length === 0) {
    return <p className="whitespace-pre-wrap break-words text-sm">{body}</p>;
  }

  const segments = parseMessageWithMentions(body, mentions);

  return (
    <p className="whitespace-pre-wrap break-words text-sm">
      {segments.map((segment, index) => {
        if (segment.isMention) {
          const displayName = segment.mention 
            ? (segment.mention.name || segment.mention.pushName || segment.mention.jid)
            : "Unknown";
          
          return (
            <span
              key={index}
              className={`font-medium ${
                fromMe
                  ? "text-emerald-100 underline decoration-emerald-200"
                  : "text-blue-600 dark:text-blue-400"
              }`}
              title={segment.mention ? `${displayName} (${segment.mention.jid})` : "Mentioned user"}
            >
              {segment.text}
            </span>
          );
        }
        return <span key={index}>{segment.text}</span>;
      })}
    </p>
  );
}
