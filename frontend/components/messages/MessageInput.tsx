"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { messagesApi } from "@/lib/api";

export function MessageInput({
  contactId,
  onSent,
}: {
  contactId: string;
  onSent?: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if ((!text.trim() && !fileInputRef.current?.files?.length) || sending) return;

    setSending(true);
    try {
      let mediaUrl: string | undefined;
      let mediaType: "image" | "video" | "audio" | "document" | undefined;

      const file = fileInputRef.current?.files?.[0];
      if (file) {
        const ext = file.name.split(".").pop();
        const fileName = `${contactId}/${Date.now()}.${ext}`;
        const { data, error } = await supabase.storage
          .from("media")
          .upload(fileName, file);

        if (error) throw error;

        const { data: publicData } = supabase.storage
          .from("media")
          .getPublicUrl(fileName);
        
        mediaUrl = publicData.publicUrl;
        
        if (file.type.startsWith("image/")) mediaType = "image";
        else if (file.type.startsWith("video/")) mediaType = "video";
        else if (file.type.startsWith("audio/")) mediaType = "audio";
        else mediaType = "document";
      }

      await messagesApi.sendMessage(contactId, {
        body: text,
        mediaUrl,
        mediaType,
      });

      setText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      onSent?.();
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title="Attach file"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            />
          </svg>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={() => {
            // Optional: show preview or just change icon state
          }}
        />
        
        <div className="relative flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex max-h-32 min-h-[40px] w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-emerald-500"
            rows={1}
            style={{
              height: "auto",
              minHeight: "40px",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${target.scrollHeight}px`;
            }}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={sending || (!text.trim() && !fileInputRef.current?.files?.length)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg
              className="h-5 w-5 ml-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
