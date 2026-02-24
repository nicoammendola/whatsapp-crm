"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { contactsApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";

export interface ConversationFilterValues {
  contactFrequency?: string;
  contactFrequencyEmpty?: boolean;
  birthdayEmpty?: string; // "true" = is empty, "false" = is not empty
  importance?: string;
  importanceEmpty?: boolean;
  relationshipType?: string;
  relationshipTypeEmpty?: boolean;
  tag?: string;
  hasReminders?: boolean;
  hasScheduledMessages?: boolean;
}

const EMPTY_FILTERS: ConversationFilterValues = {};

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

const IMPORTANCE_LEVELS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
];

function countActiveFilters(f: ConversationFilterValues): number {
  let count = 0;
  if (f.contactFrequency || f.contactFrequencyEmpty) count++;
  if (f.birthdayEmpty) count++;
  if (f.importance || f.importanceEmpty) count++;
  if (f.relationshipType || f.relationshipTypeEmpty) count++;
  if (f.tag) count++;
  if (f.hasReminders) count++;
  if (f.hasScheduledMessages) count++;
  return count;
}

interface ConversationFiltersProps {
  filters: ConversationFilterValues;
  onChange: (filters: ConversationFilterValues) => void;
}

export function ConversationFilters({ filters, onChange }: ConversationFiltersProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ConversationFilterValues>(filters);
  const [tags, setTags] = useState<string[]>([]);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const activeCount = countActiveFilters(filters);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

  const updatePanelPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPanelPos({ top: rect.bottom + 8, left: rect.left });
  }, []);

  const loadTags = useCallback(async () => {
    if (tagsLoaded) return;
    try {
      const { data } = await contactsApi.getDistinctTags();
      setTags(data.tags ?? []);
      setTagsLoaded(true);
    } catch {
      // ignore
    }
  }, [tagsLoaded]);

  useEffect(() => {
    if (open) {
      setDraft(filters);
      loadTags();
      updatePanelPosition();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const apply = () => {
    onChange(draft);
    setOpen(false);
  };

  const clear = () => {
    onChange(EMPTY_FILTERS);
    setDraft(EMPTY_FILTERS);
    setOpen(false);
  };

  const selectClasses =
    "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";

  const panel = open && panelPos
    ? createPortal(
        <div
          ref={panelRef}
          style={{ top: panelPos.top, left: panelPos.left }}
          className="fixed z-[9999] w-72 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Filter Conversations
            </h3>
          </div>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-4 py-3">
            {/* Contact Frequency */}
            <FilterGroup label="Contact Frequency">
              <select
                className={selectClasses}
                value={
                  draft.contactFrequencyEmpty
                    ? "__empty"
                    : draft.contactFrequency ?? ""
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__empty") {
                    setDraft((d) => ({
                      ...d,
                      contactFrequency: undefined,
                      contactFrequencyEmpty: true,
                    }));
                  } else {
                    setDraft((d) => ({
                      ...d,
                      contactFrequency: v || undefined,
                      contactFrequencyEmpty: false,
                    }));
                  }
                }}
              >
                <option value="">Any</option>
                <option value="__empty">Is empty</option>
                {CONTACT_FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </FilterGroup>

            {/* Birthday */}
            <FilterGroup label="Birthday">
              <select
                className={selectClasses}
                value={draft.birthdayEmpty ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    birthdayEmpty: e.target.value || undefined,
                  }))
                }
              >
                <option value="">Any</option>
                <option value="true">Is empty</option>
                <option value="false">Is not empty</option>
              </select>
            </FilterGroup>

            {/* Importance */}
            <FilterGroup label="Importance">
              <select
                className={selectClasses}
                value={
                  draft.importanceEmpty
                    ? "__empty"
                    : draft.importance ?? ""
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__empty") {
                    setDraft((d) => ({
                      ...d,
                      importance: undefined,
                      importanceEmpty: true,
                    }));
                  } else {
                    setDraft((d) => ({
                      ...d,
                      importance: v || undefined,
                      importanceEmpty: false,
                    }));
                  }
                }}
              >
                <option value="">Any</option>
                <option value="__empty">Is empty</option>
                {IMPORTANCE_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </FilterGroup>

            {/* Relationship */}
            <FilterGroup label="Relationship">
              <select
                className={selectClasses}
                value={
                  draft.relationshipTypeEmpty
                    ? "__empty"
                    : draft.relationshipType ?? ""
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__empty") {
                    setDraft((d) => ({
                      ...d,
                      relationshipType: undefined,
                      relationshipTypeEmpty: true,
                    }));
                  } else {
                    setDraft((d) => ({
                      ...d,
                      relationshipType: v || undefined,
                      relationshipTypeEmpty: false,
                    }));
                  }
                }}
              >
                <option value="">Any</option>
                <option value="__empty">Is empty</option>
                {RELATIONSHIP_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </FilterGroup>

            {/* Tags */}
            <FilterGroup label="Tagged with">
              <select
                className={selectClasses}
                value={draft.tag ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, tag: e.target.value || undefined }))
                }
              >
                <option value="">Any</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                {tags.length === 0 && (
                  <option disabled>No tags found</option>
                )}
              </select>
            </FilterGroup>

            {/* Pings / Reminders */}
            <CheckboxFilter
              label="Has ping reminders"
              checked={!!draft.hasReminders}
              onChange={(v) =>
                setDraft((d) => ({ ...d, hasReminders: v || undefined }))
              }
            />

            {/* Scheduled Messages */}
            <CheckboxFilter
              label="Has scheduled messages"
              checked={!!draft.hasScheduledMessages}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  hasScheduledMessages: v || undefined,
                }))
              }
            />
          </div>

          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <button
              onClick={clear}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Clear all
            </button>
            <Button size="sm" onClick={apply}>
              Apply
            </Button>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-center rounded-lg border p-2 transition-colors ${
          activeCount > 0
            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
            : "border-zinc-300 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        title="Filter conversations"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
        </svg>
        {activeCount > 0 && (
          <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>
      {panel}
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function CheckboxFilter({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
      />
      {label}
    </label>
  );
}

export { countActiveFilters };
