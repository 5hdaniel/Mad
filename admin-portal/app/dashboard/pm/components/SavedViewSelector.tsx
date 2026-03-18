'use client';

/**
 * SavedViewSelector - PM Backlog
 *
 * Dropdown for loading, saving, and deleting filter configurations.
 * Uses pm_list_saved_views, pm_save_view, pm_delete_saved_view RPCs.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Bookmark, X, Save, ChevronDown } from 'lucide-react';
import { listSavedViews, saveView, deleteSavedView } from '@/lib/pm-queries';
import type { PmSavedView } from '@/lib/pm-types';

interface SavedViewSelectorProps {
  currentFilters: Record<string, unknown>;
  onLoadView: (filters: Record<string, unknown>) => void;
}

export function SavedViewSelector({ currentFilters, onLoadView }: SavedViewSelectorProps) {
  const [views, setViews] = useState<PmSavedView[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const loadViews = useCallback(async () => {
    try {
      const data = await listSavedViews();
      setViews(data);
    } catch (err) {
      console.error('Failed to load saved views:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  async function handleSave() {
    if (!newName.trim()) return;
    try {
      await saveView(newName.trim(), currentFilters);
      setNewName('');
      setSaving(false);
      await loadViews();
    } catch (err) {
      console.error('Failed to save view:', err);
    }
  }

  async function handleDelete(viewId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await deleteSavedView(viewId);
      await loadViews();
    } catch (err) {
      console.error('Failed to delete view:', err);
    }
  }

  function handleLoadView(view: PmSavedView) {
    onLoadView(view.filters);
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Bookmark className="h-4 w-4" />
        Saved Views
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg border border-gray-200 shadow-lg z-20">
          <div className="p-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase px-2 py-1">
              Saved Views
            </p>
          </div>

          {loading ? (
            <div className="p-4 text-center text-sm text-gray-400">Loading...</div>
          ) : views.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">No saved views yet</div>
          ) : (
            <ul className="max-h-48 overflow-y-auto py-1">
              {views.map((view) => (
                <li key={view.id}>
                  <button
                    onClick={() => handleLoadView(view)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <span className="truncate">{view.name}</span>
                    <div className="flex items-center gap-1">
                      {view.is_shared && (
                        <span className="text-xs text-gray-400">shared</span>
                      )}
                      {view.is_own && (
                        <button
                          onClick={(e) => handleDelete(view.id, e)}
                          className="p-0.5 text-gray-400 hover:text-red-500"
                          title="Delete view"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-gray-100 p-2">
            {saving ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') setSaving(false);
                  }}
                  placeholder="View name..."
                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  disabled={!newName.trim()}
                  className="p-1 text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  title="Save"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSaving(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSaving(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded"
              >
                <Save className="h-4 w-4" />
                Save Current View
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
