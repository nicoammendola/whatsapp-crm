"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { Contact } from "@/types";

interface CustomFieldsSectionProps {
  contact: Contact;
  onUpdate: (data: Partial<Contact>) => void;
}

type FieldType = "text" | "date" | "list";

interface CustomFieldEditorProps {
  fieldName?: string;
  fieldValue?: any;
  fieldType?: FieldType;
  onSave: (name: string, value: any, type: FieldType) => void;
  onCancel: () => void;
}

export function CustomFieldsSection({ contact, onUpdate }: CustomFieldsSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  const customFields = contact.customFields || {};
  const fieldEntries = Object.entries(customFields);

  const handleSaveField = (name: string, value: any, type: FieldType) => {
    const updated = { ...customFields, [name]: { value, type } };
    onUpdate({ customFields: updated });
    setIsAdding(false);
    setEditingField(null);
  };

  const handleDeleteField = (name: string) => {
    const updated = { ...customFields };
    delete updated[name];
    onUpdate({ customFields: updated });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Custom Fields
        </h3>
        <button
          onClick={() => setIsAdding(true)}
          className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          + Add Field
        </button>
      </div>

      {isAdding && (
        <CustomFieldEditor
          onSave={handleSaveField}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {fieldEntries.length === 0 && !isAdding && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          No custom fields yet
        </p>
      )}

      <div className="space-y-3">
        {fieldEntries.map(([name, data]: [string, any]) => {
          const fieldData = data?.value !== undefined ? data : { value: data, type: "text" };
          
          if (editingField === name) {
            return (
              <CustomFieldEditor
                key={name}
                fieldName={name}
                fieldValue={fieldData.value}
                fieldType={fieldData.type}
                onSave={handleSaveField}
                onCancel={() => setEditingField(null)}
              />
            );
          }

          return (
            <CustomFieldDisplay
              key={name}
              name={name}
              value={fieldData.value}
              type={fieldData.type}
              onEdit={() => setEditingField(name)}
              onDelete={() => handleDeleteField(name)}
            />
          );
        })}
      </div>
    </div>
  );
}

function CustomFieldEditor({
  fieldName = "",
  fieldValue = "",
  fieldType = "text",
  onSave,
  onCancel,
}: CustomFieldEditorProps) {
  const [name, setName] = useState(fieldName);
  const [value, setValue] = useState(
    fieldType === "list" ? (Array.isArray(fieldValue) ? fieldValue.join(", ") : "") : fieldValue
  );
  const [type, setType] = useState<FieldType>(fieldType);

  const handleSave = () => {
    if (!name.trim()) return;
    
    let processedValue = value;
    if (type === "list") {
      processedValue = value
        .split(",")
        .map((v: string) => v.trim())
        .filter((v: string) => v);
    }
    
    onSave(name.trim(), processedValue, type);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-600 dark:bg-zinc-800/50">
      <div className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Field name"
          disabled={!!fieldName}
          className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm font-medium focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-700"
          autoFocus={!fieldName}
        />
        
        <select
          value={type}
          onChange={(e) => setType(e.target.value as FieldType)}
          className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="text">Text</option>
          <option value="date">Date</option>
          <option value="list">List (comma-separated)</option>
        </select>

        {type === "date" ? (
          <input
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={type === "list" ? "Value 1, Value 2, Value 3" : "Value"}
            className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
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
            onClick={onCancel}
            className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomFieldDisplay({
  name,
  value,
  type,
  onEdit,
  onDelete,
}: {
  name: string;
  value: any;
  type: FieldType;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const displayValue = () => {
    if (type === "date" && value) {
      try {
        return format(new Date(value), "MMM d, yyyy");
      } catch {
        return value;
      }
    }
    if (type === "list" && Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1 mt-1">
          {value.map((item, i) => (
            <span
              key={i}
              className="inline-block rounded bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-700"
            >
              {item}
            </span>
          ))}
        </div>
      );
    }
    return value;
  };

  return (
    <div className="group relative rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {name}
          </div>
          <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
            {displayValue()}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
            title="Edit"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            title="Delete"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
