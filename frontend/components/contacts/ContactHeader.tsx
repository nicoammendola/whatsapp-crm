"use client";

import { useState } from "react";
import type { Contact } from "@/types";

interface ContactHeaderProps {
  contact: Contact;
  onUpdate: (data: Partial<Contact>) => void;
}

export function ContactHeader({ contact, onUpdate }: ContactHeaderProps) {
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const contactName = contact.name || contact.pushName || contact.phoneNumber || "Unknown";
  const contactInitial = contactName.charAt(0).toUpperCase() || "?";

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (contact.tags.includes(trimmed)) {
      setTagInput("");
      return;
    }
    onUpdate({ tags: [...contact.tags, trimmed] });
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    onUpdate({ tags: contact.tags.filter((t) => t !== tag) });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === "Escape") {
      setIsEditingTags(false);
      setTagInput("");
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile Picture */}
      <div className="flex flex-col items-center">
        {contact.profilePicUrl ? (
          <img
            src={contact.profilePicUrl}
            alt={contactName}
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600 text-2xl font-semibold text-white">
            {contactInitial}
          </div>
        )}
        <h2 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {contactName}
        </h2>
        {contact.phoneNumber && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {contact.phoneNumber}
          </p>
        )}
      </div>

      {/* Tags */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Tags
          </label>
          <button
            onClick={() => setIsEditingTags(!isEditingTags)}
            className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            {isEditingTags ? "Done" : "Edit"}
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {contact.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
            >
              {tag}
              {isEditingTags && (
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-emerald-600 dark:hover:text-emerald-400"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </span>
          ))}
          
          {isEditingTags && (
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (tagInput.trim()) handleAddTag();
              }}
              placeholder="Add tag..."
              className="inline-flex rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
            />
          )}
        </div>
        
        {contact.tags.length === 0 && !isEditingTags && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">No tags yet</p>
        )}
      </div>
    </div>
  );
}
