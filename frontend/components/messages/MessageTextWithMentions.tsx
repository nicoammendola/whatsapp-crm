"use client";

import { parseMessageWithMentions, type MentionInfo } from "@/lib/mentions";

const URL_RE =
  /https?:\/\/[^\s<>""'']+/gi;

function Linkified({ text, fromMe }: { text: string; fromMe: boolean }) {
  const parts: React.ReactNode[] = [];
  let last = 0;

  for (const m of text.matchAll(URL_RE)) {
    const idx = m.index!;
    if (idx > last) parts.push(text.slice(last, idx));
    const url = m[0].replace(/[).,;:!?\]}>]+$/, "");
    parts.push(
      <a
        key={idx}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline break-all ${
          fromMe
            ? "text-emerald-800 decoration-emerald-600/50 dark:text-emerald-200 dark:decoration-emerald-400/50"
            : "text-blue-600 decoration-blue-400/50 dark:text-blue-400 dark:decoration-blue-300/50"
        }`}
      >
        {url}
      </a>
    );
    last = idx + m[0].length;
    if (m[0].length > url.length) parts.push(m[0].slice(url.length));
  }

  if (last < text.length) parts.push(text.slice(last));
  if (parts.length === 0) return <>{text}</>;
  return <>{parts}</>;
}

interface MessageTextWithMentionsProps {
  body: string;
  mentions?: MentionInfo[];
  fromMe: boolean;
  suffix?: React.ReactNode;
}

export function MessageTextWithMentions({
  body,
  mentions = [],
  fromMe,
  suffix,
}: MessageTextWithMentionsProps) {
  if (!mentions || mentions.length === 0) {
    return (
      <p className="whitespace-pre-wrap break-words text-sm">
        <Linkified text={body} fromMe={fromMe} />
        {suffix}
      </p>
    );
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
                  ? "text-emerald-800 underline decoration-emerald-600 dark:text-emerald-200 dark:decoration-emerald-400"
                  : "text-blue-600 dark:text-blue-400"
              }`}
              title={segment.mention ? `${displayName} (${segment.mention.jid})` : "Mentioned user"}
            >
              {segment.text}
            </span>
          );
        }
        return (
          <span key={index}>
            <Linkified text={segment.text} fromMe={fromMe} />
          </span>
        );
      })}
      {suffix}
    </p>
  );
}
