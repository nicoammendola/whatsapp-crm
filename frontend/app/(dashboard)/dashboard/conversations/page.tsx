"use client";

export default function ConversationsPage() {
  return (
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
  );
}
