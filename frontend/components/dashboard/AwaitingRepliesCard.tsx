import React from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import DashboardCard from './DashboardCard';
import type { ContactWithLastMessage, UrgencyLevel } from '@/types';

interface AwaitingRepliesCardProps {
  contacts: ContactWithLastMessage[];
}

const getUrgencyIndicator = (urgency: UrgencyLevel) => {
  const colors = {
    high: 'bg-red-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
  };
  return <div className={`h-2 w-2 rounded-full ${colors[urgency]}`} />;
};

const getContactName = (contact: ContactWithLastMessage) => {
  return contact.name || contact.pushName || contact.phoneNumber || contact.whatsappId.split('@')[0];
};

export default function AwaitingRepliesCard({ contacts }: AwaitingRepliesCardProps) {
  if (contacts.length === 0) {
    return (
      <DashboardCard title="Awaiting Replies" icon={<Clock className="h-5 w-5" />}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          All caught up! No pending replies.
        </p>
      </DashboardCard>
    );
  }

  const displayContacts = contacts.slice(0, 5);
  const hasMore = contacts.length > 5;

  return (
    <DashboardCard
      title="Awaiting Replies"
      icon={<Clock className="h-5 w-5" />}
      urgency={contacts[0]?.urgency || 'low'}
    >
      <div className="space-y-3">
        {displayContacts.map((contact) => (
          <Link
            key={contact.id}
            href={`/dashboard/conversations/${contact.id}`}
            className="block rounded-lg border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <div className="flex items-start gap-2">
              {getUrgencyIndicator(contact.urgency)}
              <div className="flex-1 overflow-hidden">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {getContactName(contact)}
                </p>
                {contact.lastMessageSnippet && (
                  <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
                    "{contact.lastMessageSnippet}"
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                  {formatDistanceToNow(new Date(contact.lastMessageTime), { addSuffix: true })}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {hasMore && (
        <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
          + {contacts.length - 5} more awaiting reply
        </p>
      )}
    </DashboardCard>
  );
}
