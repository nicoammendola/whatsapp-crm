"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Plus, Pencil, Trash2, Calendar } from "lucide-react";
import { contactsApi } from "@/lib/api";
import type { Reminder } from "@/types";
import { format, parseISO } from "date-fns";

interface RemindersSectionProps {
  contactId: string;
}

export function RemindersSection({ contactId }: RemindersSectionProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadReminders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await contactsApi.getReminders(contactId);
      setReminders(res.data.reminders ?? []);
    } catch (err) {
      console.error("Failed to load reminders:", err);
      setError("Failed to load reminders");
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const resetForm = () => {
    setDueDate("");
    setNotes("");
    setAdding(false);
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!dueDate.trim()) return;
    try {
      await contactsApi.createReminder(contactId, {
        dueDate: dueDate.trim(),
        notes: notes.trim() || null,
      });
      resetForm();
      loadReminders();
    } catch (err) {
      console.error("Failed to create reminder:", err);
      setError("Failed to add reminder");
    }
  };

  const handleUpdate = async (reminderId: string, nextDueDate: string, nextNotes: string) => {
    try {
      await contactsApi.updateReminder(contactId, reminderId, {
        dueDate: nextDueDate,
        notes: nextNotes || null,
      });
      setEditingId(null);
      loadReminders();
    } catch (err) {
      console.error("Failed to update reminder:", err);
      setError("Failed to update reminder");
    }
  };

  const handleDelete = async (reminderId: string) => {
    try {
      await contactsApi.deleteReminder(contactId, reminderId);
      loadReminders();
    } catch (err) {
      console.error("Failed to delete reminder:", err);
      setError("Failed to delete reminder");
    }
  };

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <Bell className="h-4 w-4" />
          Ping reminders
        </label>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            <Plus className="inline h-3.5 w-3.5" /> Add
          </button>
        )}
      </div>

      {error && (
        <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {adding && (
        <div className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-600 dark:bg-zinc-800/50">
          <div className="space-y-2">
            <div>
              <label className="mb-0.5 block text-xs text-zinc-500 dark:text-zinc-400">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={today}
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-zinc-500 dark:text-zinc-400">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Follow up on project"
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAdd}
                disabled={!dueDate}
                className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Loading reminders…</p>
      ) : reminders.length === 0 && !adding ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">No reminders. Add one to be reminded to contact this person.</p>
      ) : (
        <ul className="space-y-2">
          {reminders.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-zinc-200 bg-white py-2 pl-2 pr-2 dark:border-zinc-600 dark:bg-zinc-800/50"
            >
              {editingId === r.id ? (
                <EditReminderRow
                  reminder={r}
                  onSave={(nextDue, nextNotes) => handleUpdate(r.id, nextDue, nextNotes)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm text-zinc-900 dark:text-zinc-100">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      {format(parseISO(r.dueDate), "MMM d, yyyy")}
                    </div>
                    {r.notes && (
                      <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{r.notes}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      onClick={() => setEditingId(r.id)}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                      aria-label="Edit reminder"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-zinc-700 dark:hover:text-red-400"
                      aria-label="Delete reminder"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditReminderRow({
  reminder,
  onSave,
  onCancel,
}: {
  reminder: Reminder;
  onSave: (dueDate: string, notes: string) => void;
  onCancel: () => void;
}) {
  const [dueDate, setDueDate] = useState(reminder.dueDate.slice(0, 10));
  const [notes, setNotes] = useState(reminder.notes ?? "");

  return (
    <div className="w-full space-y-2">
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
      />
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(dueDate, notes)}
          className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:text-zinc-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
