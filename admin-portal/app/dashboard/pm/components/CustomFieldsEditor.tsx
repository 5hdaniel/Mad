'use client';

/**
 * CustomFieldsEditor - PM Project Settings
 *
 * Allows defining custom field schemas for a project.
 * Each field has a key, label, type, optional select options, and required flag.
 * Used on the project detail page and PM settings page.
 */

import { useState, useCallback } from 'react';
import { Plus, Trash2, Save, AlertCircle, GripVertical } from 'lucide-react';
import { updateFieldDefinitions } from '@/lib/pm-queries';
import type { CustomFieldDefinition, CustomFieldType } from '@/lib/pm-types';

// -- Props -------------------------------------------------------------------

interface CustomFieldsEditorProps {
  projectId: string;
  definitions: CustomFieldDefinition[];
  onUpdate: () => void;
}

// -- Helpers -----------------------------------------------------------------

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
];

function generateKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

// -- Component ---------------------------------------------------------------

export function CustomFieldsEditor({
  projectId,
  definitions,
  onUpdate,
}: CustomFieldsEditorProps) {
  const [fields, setFields] = useState<CustomFieldDefinition[]>(definitions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // New field form state
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<CustomFieldType>('text');
  const [newOptions, setNewOptions] = useState('');
  const [newRequired, setNewRequired] = useState(false);

  const hasChanges =
    JSON.stringify(fields) !== JSON.stringify(definitions);

  const handleAddField = useCallback(() => {
    const label = newLabel.trim();
    if (!label) return;

    const key = generateKey(label);

    // Check for duplicate keys
    if (fields.some((f) => f.key === key)) {
      setError(`A field with key "${key}" already exists.`);
      return;
    }

    const field: CustomFieldDefinition = {
      key,
      label,
      type: newType,
      required: newRequired || undefined,
    };

    if (newType === 'select' && newOptions.trim()) {
      field.options = newOptions
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    }

    setFields([...fields, field]);
    setNewLabel('');
    setNewType('text');
    setNewOptions('');
    setNewRequired(false);
    setShowAddForm(false);
    setError(null);
  }, [fields, newLabel, newType, newOptions, newRequired]);

  const handleRemoveField = useCallback(
    (key: string) => {
      setFields(fields.filter((f) => f.key !== key));
    },
    [fields]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await updateFieldDefinitions(projectId, fields);
      setSuccessMsg('Custom fields saved successfully.');
      onUpdate();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save custom fields'
      );
    } finally {
      setSaving(false);
    }
  }, [projectId, fields, onUpdate]);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Custom Fields
          </h3>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Field
            </button>
          </div>
        </div>
      </div>

      {/* Error / Success messages */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        </div>
      )}
      {successMsg && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-200">
          <p className="text-sm text-green-700">{successMsg}</p>
        </div>
      )}

      {/* Add field form */}
      {showAddForm && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Label
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Budget, Client Name"
                className="w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Type
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as CustomFieldType)}
                className="w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FIELD_TYPES.map((ft) => (
                  <option key={ft.value} value={ft.value}>
                    {ft.label}
                  </option>
                ))}
              </select>
            </div>
            {newType === 'select' && (
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Options (comma-separated)
                </label>
                <input
                  type="text"
                  value={newOptions}
                  onChange={(e) => setNewOptions(e.target.value)}
                  placeholder="e.g. Option A, Option B, Option C"
                  className="w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <div className="sm:col-span-2 flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={newRequired}
                  onChange={(e) => setNewRequired(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Required
              </label>
              <div className="flex-1" />
              <button
                onClick={() => setShowAddForm(false)}
                className="text-xs px-3 py-1.5 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddField}
                disabled={!newLabel.trim()}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Field list */}
      {fields.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-gray-400">
            No custom fields defined. Click &quot;Add Field&quot; to create one.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {fields.map((field) => (
            <div
              key={field.key}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {field.label}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {field.key}
                  </span>
                  {field.required && (
                    <span className="text-xs text-red-500">*</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                    {field.type}
                  </span>
                  {field.type === 'select' && field.options && (
                    <span className="text-xs text-gray-400 truncate">
                      {field.options.join(', ')}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRemoveField(field.key)}
                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                title="Remove field"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
