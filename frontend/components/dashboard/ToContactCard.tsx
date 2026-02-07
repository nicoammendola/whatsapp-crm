import React from 'react';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import DashboardCard from './DashboardCard';
import type { ContactToReachOut, UrgencyLevel } from '@/types';

interface ToContactCardProps {
  contacts: ContactToReachOut[];
}

const getUrgencyIndicator = (urgency: UrgencyLevel) => {
  const colors = {
    high: 'bg-red-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
  };
  return <div className={`h-2 w-2 rounded-full ${colors[urgency]}`} />;
};

const getContactName = (contact: ContactToReachOut) => {
  return contact.name || contact.pushName || contact.phoneNumber || contact.whatsappId.split('@')[0];
};

const formatFrequency = (frequency: string) => {
  return frequency.charAt(0).toUpperCase() + frequency.slice(1);
};

export default function ToContactCard({ contacts }: ToContactCardProps) {
  if (contacts.length === 0) {
    return (
      <DashboardCard title="Time to Reach Out" icon={<Calendar className="h-5 w-5" />}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          All relationships are on track! Set contact frequency targets to see suggestions here.
        </p>
      </DashboardCard>
    );
  }

  const displayContacts = contacts.slice(0, 5);
  const hasMore = contacts.length > 5;

  return (
    <DashboardCard
      title="Time to Reach Out"
      icon={<Calendar className="h-5 w-5" />}
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
              <div className="flex-1">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {getContactName(contact)}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Target: {formatFrequency(contact.contactFrequency)}
                </p>
                {contact.lastInteraction ? (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                    Last contact: {formatDistanceToNow(new Date(contact.lastInteraction), { addSuffix: true })}
                    {contact.daysOverdue > 0 && (
                      <span className="ml-1 font-medium text-red-600 dark:text-red-400">
                        ({contact.daysOverdue} {contact.daysOverdue === 1 ? 'day' : 'days'} overdue)
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                    No recent contact
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {hasMore && (
        <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
          + {contacts.length - 5} more need attention
        </p>
      )}
    </DashboardCard>
  );
}
