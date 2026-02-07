"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { ConversationList } from "@/components/conversations/ConversationList";

export default function ConversationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the current [contactId] segment from the URL
  const selectedContactId = useSelectedLayoutSegment();

  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] min-h-0 md:-m-6 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="w-[360px] flex-shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-700 h-full overflow-hidden">
         <ConversationList selectedContactId={selectedContactId} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}
