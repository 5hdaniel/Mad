'use client';

/**
 * ProjectTasks -- Item display components for the project detail page.
 *
 * Contains:
 * - InlineItemCreate: "+ Add item" row for creating new items
 * - MiniItemTable: Compact item table for sprint sections / backlog
 * - BacklogPanel: Items not assigned to any sprint
 * - SprintSection: Collapsible sprint with lazy-loaded items
 */

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Loader2,
  Package,
} from 'lucide-react';
import { listItems, createItem } from '@/lib/pm-queries';
import type { PmBacklogItem, PmSprint } from '@/lib/pm-types';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  TYPE_LABELS,
  TYPE_COLORS,
  SPRINT_STATUS_LABELS,
  SPRINT_STATUS_COLORS,
} from '@/lib/pm-types';

// ---------------------------------------------------------------------------
// InlineItemCreate -- "+ Add item" row
// ---------------------------------------------------------------------------

interface InlineItemCreateProps {
  projectId: string;
  sprintId?: string | null;
  onCreated: () => void;
}

export function InlineItemCreate({ projectId, sprintId, onCreated }: InlineItemCreateProps) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 py-2 px-1"
      >
        <Plus className="h-3 w-3" /> Add item
      </button>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSubmitting(true);
        try {
          await createItem({
            title: title.trim(),
            sprint_id: sprintId || undefined,
            project_id: projectId,
          });
          setTitle('');
          setAdding(false);
          onCreated();
        } catch (err) {
          console.error('Failed to create:', err);
        } finally {
          setSubmitting(false);
        }
      }}
      className="flex items-center gap-2 py-2 px-1"
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Item title..."
        className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        autoFocus
      />
      <button
        type="submit"
        disabled={submitting || !title.trim()}
        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? 'Adding...' : 'Add'}
      </button>
      <button
        type="button"
        onClick={() => { setAdding(false); setTitle(''); }}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// MiniItemTable -- Compact item table for sprint sections / backlog
// ---------------------------------------------------------------------------

interface MiniItemTableProps {
  items: PmBacklogItem[];
  projectId: string;
}

export function MiniItemTable({ items, projectId }: MiniItemTableProps) {
  const router = useRouter();

  if (items.length === 0) {
    return (
      <p className="text-xs text-gray-400 py-2">No items in this section.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead>
          <tr className="text-xs text-gray-500 uppercase tracking-wider">
            <th className="px-2 py-1.5 text-left font-medium">ID</th>
            <th className="px-2 py-1.5 text-left font-medium">Title</th>
            <th className="px-2 py-1.5 text-left font-medium">Status</th>
            <th className="px-2 py-1.5 text-left font-medium">Priority</th>
            <th className="px-2 py-1.5 text-left font-medium hidden md:table-cell">Type</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => {
            const itemUrl = `/dashboard/pm/tasks/${item.id}?from=project&projectId=${projectId}`;
            return (
              <tr
                key={item.id}
                onClick={() => router.push(itemUrl)}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">
                  #{item.item_number}
                </td>
                <td className="px-2 py-1.5 text-gray-900 font-medium truncate max-w-[200px]">
                  <Link
                    href={itemUrl}
                    className="hover:text-blue-600 hover:underline"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    {item.title}
                  </Link>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status]}`}
                  >
                    {STATUS_LABELS[item.status]}
                  </span>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[item.priority]}`}
                  >
                    {PRIORITY_LABELS[item.priority]}
                  </span>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap hidden md:table-cell">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[item.type]}`}
                  >
                    {TYPE_LABELS[item.type]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SprintSection -- Collapsible sprint with lazy-loaded items
// ---------------------------------------------------------------------------

interface SprintSectionProps {
  sprint: PmSprint;
  projectId: string;
  onRefresh: () => void;
}

export function SprintSection({ sprint, projectId, onRefresh }: SprintSectionProps) {
  const defaultExpanded =
    sprint.status === 'active' || sprint.status === 'planned';
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [items, setItems] = useState<PmBacklogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listItems({
        sprint_id: sprint.id,
        project_id: projectId,
        page_size: 200,
      });
      setItems(res.items);
      setLoaded(true);
    } catch (err) {
      console.error('Failed to load project data:', err);
    } finally {
      setLoading(false);
    }
  }, [sprint.id, projectId]);

  useEffect(() => {
    if (expanded && !loaded) loadItems();
  }, [expanded, loaded, loadItems]);

  const completed = sprint.item_counts?.completed ?? 0;
  const total = sprint.total_items ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const handleItemCreated = useCallback(() => {
    loadItems();
    onRefresh();
  }, [loadItems, onRefresh]);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
        )}
        <Link
          href={`/dashboard/pm/sprints/${sprint.id}`}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          className="font-medium text-gray-900 hover:text-blue-600 hover:underline truncate"
        >
          {sprint.name}
        </Link>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${SPRINT_STATUS_COLORS[sprint.status]}`}
        >
          {SPRINT_STATUS_LABELS[sprint.status]}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden hidden sm:block">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {completed}/{total}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-2 border-t border-gray-100">
          {loading ? (
            <div className="flex items-center gap-2 py-4 justify-center text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Loading items...</span>
            </div>
          ) : (
            <MiniItemTable items={items} projectId={projectId} />
          )}
          <InlineItemCreate
            projectId={projectId}
            sprintId={sprint.id}
            onCreated={handleItemCreated}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BacklogPanel -- Items not assigned to any sprint
// ---------------------------------------------------------------------------

interface BacklogPanelProps {
  items: PmBacklogItem[];
  projectId: string;
  loading: boolean;
  onRefresh: () => void;
}

export function BacklogPanel({ items, projectId, loading, onRefresh }: BacklogPanelProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-gray-500" />
          <h3 className="font-medium text-gray-900 text-sm">
            Backlog (unassigned)
          </h3>
          <span className="text-xs text-gray-500">({items.length})</span>
        </div>
      </div>

      <div className="px-4 py-2">
        {loading ? (
          <div className="flex items-center gap-2 py-4 justify-center text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Loading...</span>
          </div>
        ) : (
          <MiniItemTable items={items} projectId={projectId} />
        )}
        <InlineItemCreate
          projectId={projectId}
          sprintId={null}
          onCreated={onRefresh}
        />
      </div>
    </div>
  );
}
