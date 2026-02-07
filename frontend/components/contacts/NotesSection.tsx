"use client";

import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import type { Contact } from "@/types";

interface NotesSectionProps {
  contact: Contact;
  onUpdate: (data: Partial<Contact>) => void;
}

type SaveState = "idle" | "typing" | "saving" | "saved" | "error";

export function NotesSection({ contact, onUpdate }: NotesSectionProps) {
  const [notes, setNotes] = useState(contact.notes || "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef(contact.notes || "");

  // Update local state when contact prop changes
  useEffect(() => {
    setNotes(contact.notes || "");
    lastSavedRef.current = contact.notes || "";
  }, [contact.notes]);

  const handleChange = (value: string) => {
    setNotes(value);
    setSaveState("typing");

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for auto-save (1.5 seconds)
    timeoutRef.current = setTimeout(() => {
      if (value !== lastSavedRef.current) {
        saveNotes(value);
      } else {
        setSaveState("idle");
      }
    }, 1500);
  };

  const saveNotes = async (value: string) => {
    setSaveState("saving");
    try {
      await onUpdate({ notes: value });
      lastSavedRef.current = value;
      setSaveState("saved");
      
      // Reset to idle after 2 seconds
      setTimeout(() => {
        setSaveState("idle");
      }, 2000);
    } catch (error) {
      console.error("Failed to save notes:", error);
      setSaveState("error");
      
      // Reset to idle after 3 seconds
      setTimeout(() => {
        setSaveState("idle");
      }, 3000);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Notes
        </h3>
        <SaveIndicator state={saveState} />
      </div>

      <textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Add notes about this contact..."
        className="w-full min-h-[200px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 resize-y"
      />

      {contact.updatedAt && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Last updated {formatDistanceToNow(new Date(contact.updatedAt), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {state === "typing" && (
        <span className="text-zinc-400 dark:text-zinc-500">Typing...</span>
      )}
      {state === "saving" && (
        <>
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span className="text-zinc-600 dark:text-zinc-400">Saving...</span>
        </>
      )}
      {state === "saved" && (
        <>
          <svg className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-600 dark:text-emerald-400">Saved</span>
        </>
      )}
      {state === "error" && (
        <>
          <svg className="h-3.5 w-3.5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="text-red-600 dark:text-red-400">Failed to save</span>
        </>
      )}
    </div>
  );
}
