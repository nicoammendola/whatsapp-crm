"use client";

import { use } from "react";
import { ConversationsView } from "@/components/conversations/ConversationsView";

export default function ConversationDetailPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = use(params);
  return <ConversationsView contactId={contactId} />;
}
