'use client';

/**
 * Project Detail Page - /dashboard/pm/projects/[id]
 *
 * Redesigned layout with:
 * - Project header with status badge and description
 * - Status summary progress bar and status badges
 * - Token metric cards
 * - Responsive side-by-side layout (wide) / stacked (narrow):
 *   - Left/Top: Backlog panel (unassigned items)
 *   - Right/Bottom: Collapsible sprint sections with item tables
 * - Inline item creation in backlog and sprint sections
 * - Inline sprint creation at bottom of sprint list
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FolderKanban,
  Coins,
  TrendingUp,
  TrendingDown,
  Calendar,
  Info,
  Plus,
  ChevronDown,
  ChevronRight,
  Loader2,
  Package,
} from 'lucide-react';
import {
  getProjectDetail,
  listItems,
  createItem,
  createSprint,
} from '@/lib/pm-queries';
import type {
  PmProject,
  PmBacklogItem,
  PmSprint,
  ItemStatus,
  SprintStatus,
} from '@/lib/pm-types';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  SPRINT_STATUS_LABELS,
  SPRINT_STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  TYPE_LABELS,
  TYPE_COLORS,
} from '@/lib/pm-types';
import { DualProgressBar } from '../../components/DualProgressBar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format token count for display (e.g. 1500 -> "2K", 1200000 -> "1.2M"). */
function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
  return String(tokens);
}

const STATUS_ORDER: ItemStatus[] = [
  'pending',
  'in_progress',
  'testing',
  'completed',
  'blocked',
  'deferred',
  'reopened',
  'obsolete',
];

// ---------------------------------------------------------------------------
// InlineItemCreate -- "+ Add item" row
// ---------------------------------------------------------------------------

interface InlineItemCreateProps {
  projectId: string;
  sprintId?: string | null;
  onCreated: () => void;
}

function InlineItemCreate({ projectId, sprintId, onCreated }: InlineItemCreateProps) {
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
        } catch {
          // silent -- user can retry
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
        onClick={() => {
          setAdding(false);
          setTitle('');
        }}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// InlineSprintCreate -- "+ Create new sprint" row
// ---------------------------------------------------------------------------

interface InlineSprintCreateProps {
  projectId: string;
  onCreated: () => void;
}

function InlineSprintCreate({ projectId, onCreated }: InlineSprintCreateProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 py-3 px-4"
      >
        <Plus className="h-4 w-4" /> Create new sprint
      </button>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSubmitting(true);
        try {
          await createSprint(name.trim(), goal.trim() || null, projectId);
          setName('');
          setGoal('');
          setAdding(false);
          onCreated();
        } catch {
          // silent -- user can retry
        } finally {
          setSubmitting(false);
        }
      }}
      className="border border-gray-200 rounded-lg p-4 space-y-3"
    >
      <div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sprint name..."
          className="w-full text-sm border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
        />
      </div>
      <div>
        <input
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Sprint goal (optional)..."
          className="w-full text-sm border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Sprint'}
        </button>
        <button
          type="button"
          onClick={() => {
            setAdding(false);
            setName('');
            setGoal('');
          }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
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

function MiniItemTable({ items, projectId }: MiniItemTableProps) {
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

function SprintSection({ sprint, projectId, onRefresh }: SprintSectionProps) {
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
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [sprint.id, projectId]);

  // Lazy-load items when first expanded
  useEffect(() => {
    if (expanded && !loaded) {
      loadItems();
    }
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
      {/* Header */}
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

      {/* Expanded content */}
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

function BacklogPanel({ items, projectId, loading, onRefresh }: BacklogPanelProps) {
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

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  // Project detail state
  const [project, setProject] = useState<PmProject | null>(null);
  const [sprints, setSprints] = useState<PmSprint[]>([]);
  const [itemsByStatus, setItemsByStatus] = useState<Record<string, number>>(
    {}
  );
  const [loadingDetail, setLoadingDetail] = useState(true);

  // Backlog items (unassigned to any sprint)
  const [allItems, setAllItems] = useState<PmBacklogItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // Load project detail
  const loadDetail = useCallback(async () => {
    setLoadingDetail(true);
    try {
      const data = await getProjectDetail(projectId);
      setProject(data.project);
      setSprints(data.sprints);
      setItemsByStatus(data.items_by_status);
    } catch {
      // silent
    } finally {
      setLoadingDetail(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // Load ALL items for this project to find unassigned ones + compute token sums
  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const data = await listItems({
        project_id: projectId,
        page_size: 500,
      });
      setAllItems(data.items);
    } catch {
      // silent
    } finally {
      setLoadingItems(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Filter to unassigned items (no sprint_id)
  const backlogItems = useMemo(
    () => allItems.filter((item) => !item.sprint_id),
    [allItems]
  );

  // Compute total and progress from itemsByStatus
  const totalItems = Object.values(itemsByStatus).reduce((a, b) => a + b, 0);
  const completedItems = itemsByStatus['completed'] ?? 0;
  const progressPct =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Compute token sums from all loaded items
  const tokenSums = useMemo(() => {
    let estTotal = 0;
    let actualTotal = 0;
    for (const item of allItems) {
      estTotal += item.est_tokens ?? 0;
      actualTotal += item.actual_tokens ?? 0;
    }
    const variance =
      estTotal > 0 ? ((actualTotal - estTotal) / estTotal) * 100 : 0;
    return { estTotal, actualTotal, variance };
  }, [allItems]);

  // Sort sprints: active first, then planned, then completed, then cancelled
  const sortedSprints = useMemo(() => {
    const order: Record<SprintStatus, number> = {
      active: 0,
      planned: 1,
      completed: 2,
      cancelled: 3,
    };
    return [...sprints].sort(
      (a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99)
    );
  }, [sprints]);

  // Refresh everything
  const refreshAll = useCallback(() => {
    loadDetail();
    loadItems();
  }, [loadDetail, loadItems]);

  // Loading state
  if (loadingDetail) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/pm/projects"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Link>
        </div>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/pm/projects"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Link>
        </div>
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">Project not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/dashboard/pm/projects"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>

        {/* Project header */}
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <FolderKanban className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {project.name}
              </h1>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  project.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {project.status === 'active' ? 'Active' : 'Archived'}
              </span>
            </div>
            {project.description && (
              <p className="text-sm text-gray-500 mt-1">
                {project.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Status summary with progress bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Status Summary
        </h2>

        <DualProgressBar
          completed={completedItems}
          total={totalItems}
          byStatus={itemsByStatus}
          estTokens={tokenSums.estTotal}
          actualTokens={tokenSums.actualTotal}
          showLegend={false}
        />

        {/* Status badges */}
        {totalItems > 0 ? (
          <div className="flex flex-wrap gap-3 mt-4">
            {STATUS_ORDER.filter((s) => (itemsByStatus[s] ?? 0) > 0).map(
              (status) => (
                <div key={status} className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                    {itemsByStatus[status]}
                  </span>
                </div>
              )
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 mt-4">
            No items in this project yet.
          </p>
        )}
      </div>

      {/* Token Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Coins className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Estimated Tokens</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatTokens(tokenSums.estTotal)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50">
              <Coins className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Actual Tokens</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatTokens(tokenSums.actualTotal)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            {(() => {
              const isOver = tokenSums.variance > 0;
              const Icon = isOver ? TrendingUp : TrendingDown;
              return (
                <>
                  <div
                    className={`p-2 rounded-lg ${isOver ? 'bg-red-50' : 'bg-green-50'}`}
                  >
                    <Icon
                      className={`h-5 w-5 ${isOver ? 'text-red-600' : 'text-green-600'}`}
                    />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Variance</p>
                    <p
                      className={`text-2xl font-bold ${isOver ? 'text-red-600' : 'text-green-600'}`}
                    >
                      {isOver ? '+' : ''}
                      {tokenSums.variance.toFixed(0)}%
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-sm text-gray-500">Days Open</p>
                <span title="Days since project was created">
                  <Info className="h-3.5 w-3.5 text-gray-400" />
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {Math.floor(
                  (Date.now() - new Date(project.created_at).getTime()) /
                    (1000 * 60 * 60 * 24)
                )}{' '}
                days
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive layout: Backlog panel + Sprint sections */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Backlog panel (left on wide, top on narrow) */}
        <div className="w-full lg:w-1/3 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto">
          <BacklogPanel
            items={backlogItems}
            projectId={projectId}
            loading={loadingItems}
            onRefresh={refreshAll}
          />
        </div>

        {/* Sprint sections (right on wide, bottom on narrow) */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold text-gray-900">Sprints</h2>
            <span className="text-sm text-gray-500">
              ({sortedSprints.length})
            </span>
          </div>

          {sortedSprints.length === 0 && !loadingDetail ? (
            <div className="border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-sm text-gray-400">
                No sprints yet. Create one below.
              </p>
            </div>
          ) : (
            sortedSprints.map((sprint) => (
              <SprintSection
                key={sprint.id}
                sprint={sprint}
                projectId={projectId}
                onRefresh={refreshAll}
              />
            ))
          )}

          {/* Inline sprint creation */}
          <InlineSprintCreate projectId={projectId} onCreated={refreshAll} />
        </div>
      </div>
    </div>
  );
}
