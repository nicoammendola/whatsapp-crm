"use client";

import { useState } from "react";
import { format, differenceInYears } from "date-fns";
import type { Contact } from "@/types";

interface InfoSectionProps {
  contact: Contact;
  onUpdate: (data: Partial<Contact>) => void;
}

const RELATIONSHIP_TYPES = [
  { value: "family", label: "Family" },
  { value: "close_friend", label: "Close Friend" },
  { value: "colleague", label: "Colleague" },
  { value: "acquaintance", label: "Acquaintance" },
  { value: "other", label: "Other" },
];

const CONTACT_FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

export function InfoSection({ contact, onUpdate }: InfoSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Contact Information
      </h3>

      <EditableField
        label="Birthday"
        value={contact.birthday}
        type="date"
        icon={CalendarIcon}
        onSave={(value) => onUpdate({ birthday: value })}
        formatDisplay={(val) => {
          if (!val) return null;
          const date = new Date(val);
          const age = differenceInYears(new Date(), date);
          return `${format(date, "MMM d, yyyy")} (${age} years old)`;
        }}
      />

      <EditableField
        label="Company"
        value={contact.company}
        type="text"
        icon={BriefcaseIcon}
        onSave={(value) => onUpdate({ company: value })}
      />

      <EditableField
        label="Job Title"
        value={contact.jobTitle}
        type="text"
        icon={BadgeIcon}
        onSave={(value) => onUpdate({ jobTitle: value })}
      />

      <EditableField
        label="Location"
        value={contact.location}
        type="text"
        icon={MapPinIcon}
        onSave={(value) => onUpdate({ location: value })}
      />

      <EditableField
        label="Relationship"
        value={contact.relationshipType}
        type="select"
        options={RELATIONSHIP_TYPES}
        icon={UsersIcon}
        onSave={(value) => onUpdate({ relationshipType: value })}
      />

      <EditableField
        label="Contact Frequency"
        value={contact.contactFrequency}
        type="select"
        options={CONTACT_FREQUENCIES}
        icon={ClockIcon}
        onSave={(value) => onUpdate({ contactFrequency: value })}
      />

      <ImportanceField
        value={contact.importance ?? 0}
        onSave={(value) => onUpdate({ importance: value })}
      />
    </div>
  );
}

interface EditableFieldProps {
  label: string;
  value: string | null | undefined;
  type: "text" | "date" | "select";
  icon: React.ComponentType<{ className?: string }>;
  options?: { value: string; label: string }[];
  onSave: (value: string | null) => void;
  formatDisplay?: (value: string) => string | null;
}

function EditableField({
  label,
  value,
  type,
  icon: Icon,
  options,
  onSave,
  formatDisplay,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");

  const displayValue = value
    ? formatDisplay
      ? formatDisplay(value)
      : options?.find((o) => o.value === value)?.label || value
    : null;

  const handleSave = () => {
    onSave(editValue || null);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 mt-1 flex-shrink-0 text-zinc-400 dark:text-zinc-500" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">{label}</div>
        {isEditing ? (
          <div className="space-y-2">
            {type === "select" && options ? (
              <select
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                autoFocus
              >
                <option value="">None</option>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={type}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                autoFocus
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setIsEditing(true);
              setEditValue(value || "");
            }}
            className="group w-full text-left text-sm text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            {displayValue || (
              <span className="text-zinc-400 dark:text-zinc-500 group-hover:text-emerald-500">
                Add {label.toLowerCase()}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function ImportanceField({
  value,
  onSave,
}: {
  value: number;
  onSave: (value: number) => void;
}) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  return (
    <div className="flex items-start gap-2">
      <StarIcon className="h-4 w-4 mt-1 flex-shrink-0 text-zinc-400 dark:text-zinc-500" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Importance</div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => onSave(star === value ? 0 : star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(null)}
              className="text-zinc-300 hover:text-yellow-400 dark:text-zinc-600 dark:hover:text-yellow-400 transition-colors"
            >
              <StarIcon
                className={`h-5 w-5 ${
                  star <= (hoveredStar ?? value)
                    ? "fill-yellow-400 text-yellow-400"
                    : ""
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Icon components
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function BadgeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
      />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  );
}
