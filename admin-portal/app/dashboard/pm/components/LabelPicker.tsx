'use client';

/**
 * LabelPicker - PM Item Detail
 *
 * Multi-select label/tag picker with color support.
 * Shows currently applied labels as colored pills, with a dropdown
 * to add/remove labels and create new ones.
 */

import { useState, useEffect, useRef } from 'react';
import { Plus, X, Loader2, Check } from 'lucide-react';
import {
  listLabels,
  addItemLabel,
  removeItemLabel,
  createLabel,
} from '@/lib/pm-queries';
import type { PmLabel } from '@/lib/pm-types';

interface LabelPickerProps {
  itemId: string;
  currentLabels: PmLabel[];
  onUpdate: () => void;
}

/** Determine if a background color is dark, to choose white or dark text. */
function getTextColor(bgColor: string): string {
  try {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1f2937' : '#ffffff';
  } catch {
    return '#1f2937';
  }
}

export function LabelPicker({ itemId, currentLabels, onUpdate }: LabelPickerProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [allLabels, setAllLabels] = useState<PmLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentLabelIds = new Set(currentLabels.map((l) => l.id));

  // Load all labels when dropdown opens
  useEffect(() => {
    if (!showDropdown) return;

    setLoading(true);
    listLabels()
      .then(setAllLabels)
      .catch(() => setAllLabels([]))
      .finally(() => setLoading(false));
  }, [showDropdown]);

  // Focus search when dropdown opens
  useEffect(() => {
    if (showDropdown && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showDropdown]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;

    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setSearchQuery('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const filteredLabels = allLabels.filter((label) =>
    label.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showCreateOption =
    searchQuery.trim() &&
    !filteredLabels.some((l) => l.name.toLowerCase() === searchQuery.trim().toLowerCase());

  async function handleToggleLabel(label: PmLabel) {
    setUpdating(label.id);
    setError(null);
    try {
      if (currentLabelIds.has(label.id)) {
        await removeItemLabel(itemId, label.id);
      } else {
        await addItemLabel(itemId, label.id);
      }
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update label');
    } finally {
      setUpdating(null);
    }
  }

  async function handleCreateLabel() {
    const name = searchQuery.trim();
    if (!name) return;

    setCreating(true);
    setError(null);
    try {
      const result = await createLabel(name);
      // Immediately add the new label to the item
      await addItemLabel(itemId, result.id);
      setSearchQuery('');
      onUpdate();
      // Refresh label list
      const updated = await listLabels();
      setAllLabels(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create label');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="px-4 py-3">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        Labels
      </span>

      <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
        {currentLabels.map((label) => (
          <span
            key={label.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: label.color,
              color: getTextColor(label.color),
            }}
          >
            {label.name}
            <button
              onClick={() => handleToggleLabel(label)}
              disabled={updating === label.id}
              className="hover:opacity-70"
              title={`Remove ${label.name}`}
            >
              {updating === label.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </button>
          </span>
        ))}

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>

          {showDropdown && (
            <div className="absolute z-10 mt-1 left-0 w-56 bg-white border border-gray-200 rounded-md shadow-lg">
              <div className="p-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search labels..."
                  className="w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && (
                <p className="px-2 text-xs text-red-500">{error}</p>
              )}

              <div className="max-h-40 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 px-3 py-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading...
                  </div>
                ) : filteredLabels.length === 0 && !showCreateOption ? (
                  <p className="text-xs text-gray-400 px-3 py-2">No labels found</p>
                ) : (
                  filteredLabels.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => handleToggleLabel(label)}
                      disabled={updating === label.id}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="truncate flex-1 text-left">{label.name}</span>
                      {currentLabelIds.has(label.id) && (
                        <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      )}
                      {updating === label.id && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>

              {showCreateOption && (
                <button
                  onClick={handleCreateLabel}
                  disabled={creating}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {creating ? 'Creating...' : `Create "${searchQuery.trim()}"`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
