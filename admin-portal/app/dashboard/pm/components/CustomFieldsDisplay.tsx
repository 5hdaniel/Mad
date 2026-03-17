'use client';

/**
 * CustomFieldsDisplay - PM Task Detail Sidebar
 *
 * Shows custom field values for a backlog item. Each field is editable inline:
 * text inputs, number inputs, date pickers, or select dropdowns based on the
 * field type. Saves on blur or Enter.
 */

import { useState, useCallback, useEffect } from 'react';
import { AlertCircle, Settings2 } from 'lucide-react';
import { updateCustomField } from '@/lib/pm-queries';
import type { CustomFieldDefinition } from '@/lib/pm-types';

// -- Props -------------------------------------------------------------------

interface CustomFieldsDisplayProps {
  itemId: string;
  definitions: CustomFieldDefinition[];
  values: Record<string, unknown>;
  onUpdate: () => void;
}

// -- Single field editor -----------------------------------------------------

interface FieldEditorProps {
  definition: CustomFieldDefinition;
  value: unknown;
  onSave: (key: string, value: unknown) => Promise<void>;
}

function FieldEditor({ definition, value, onSave }: FieldEditorProps) {
  const [localValue, setLocalValue] = useState<string>(
    value != null ? String(value) : ''
  );
  const [saving, setSaving] = useState(false);

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value != null ? String(value) : '');
  }, [value]);

  const handleSave = useCallback(async () => {
    const trimmed = localValue.trim();
    const currentStr = value != null ? String(value) : '';
    if (trimmed === currentStr) return;

    setSaving(true);
    try {
      let parsedValue: unknown = trimmed || null;
      if (definition.type === 'number' && trimmed) {
        parsedValue = Number(trimmed);
        if (isNaN(parsedValue as number)) {
          parsedValue = null;
        }
      }
      await onSave(definition.key, parsedValue);
    } finally {
      setSaving(false);
    }
  }, [localValue, value, definition.key, definition.type, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave();
      }
    },
    [handleSave]
  );

  const baseInputClass =
    'w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50';

  switch (definition.type) {
    case 'text':
      return (
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder={`Enter ${definition.label.toLowerCase()}`}
          disabled={saving}
          className={baseInputClass}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder="0"
          disabled={saving}
          className={baseInputClass}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
          }}
          onBlur={handleSave}
          disabled={saving}
          className={baseInputClass}
        />
      );

    case 'select':
      return (
        <select
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            // Save immediately on select change
            const trimmed = e.target.value.trim();
            const currentStr = value != null ? String(value) : '';
            if (trimmed !== currentStr) {
              setSaving(true);
              onSave(definition.key, trimmed || null).finally(() =>
                setSaving(false)
              );
            }
          }}
          disabled={saving}
          className={baseInputClass}
        >
          <option value="">Select...</option>
          {(definition.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    default:
      return (
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className={baseInputClass}
        />
      );
  }
}

// -- Component ---------------------------------------------------------------

export function CustomFieldsDisplay({
  itemId,
  definitions,
  values,
  onUpdate,
}: CustomFieldsDisplayProps) {
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(
    async (key: string, value: unknown) => {
      setError(null);
      try {
        await updateCustomField(itemId, key, value);
        onUpdate();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to update custom field'
        );
      }
    },
    [itemId, onUpdate]
  );

  if (definitions.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">
            Custom Fields
          </h3>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {definitions.map((def) => (
          <div key={def.key} className="px-4 py-3">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
              {def.label}
              {def.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <FieldEditor
              definition={def}
              value={values[def.key]}
              onSave={handleSave}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
