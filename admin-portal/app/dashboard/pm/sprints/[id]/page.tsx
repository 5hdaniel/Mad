'use client';

/**
 * Sprint Detail Page - /dashboard/pm/sprints/[id]
 *
 * Shows full sprint information: header with status badge, goal, date range,
 * item progress breakdown, token metric cards with tooltips,
 * and a paginated task table of sprint items.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Target,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Trash2,
  Coins,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react';
import { getSprintDetail, listItems, deleteSprint, updateSprintField } from '@/lib/pm-queries';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import { PERMISSIONS } from '@/lib/permissions';
import type {
  PmBacklogItem,
  SprintDetailResponse,
  ItemStatus,
} from '@/lib/pm-types';
import { SPRINT_STATUS_LABELS, SPRINT_STATUS_COLORS } from '@/lib/pm-types';
import { TaskTable } from '../../components/TaskTable';
import { DualProgressBar } from '../../components/DualProgressBar';
import { InlineEditText } from '../../components/InlineEditText';
import { formatTokens } from '@/lib/pm-utils';

export default function SprintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sprintId = params.id as string;
  const { hasPermission } = usePermissions();

  const [detail, setDetail] = useState<SprintDetailResponse | null>(null);
  const [items, setItems] = useState<PmBacklogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const pageSize = 50;

  // Load sprint detail (showSpinner=true for initial load, false for inline refreshes)
  const loadDetail = useCallback(async (showSpinner = true) => {
    if (!sprintId) return;
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const data = await getSprintDetail(sprintId);
      setDetail(data);
    } catch (err) {
      console.error('Failed to load sprint detail:', err);
      setError('Failed to load sprint detail.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [sprintId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // Load paginated items
  const loadItems = useCallback(async () => {
    if (!sprintId) return;

    setItemsLoading(true);
    try {
      const data = await listItems({
        sprint_id: sprintId,
        page,
        page_size: pageSize,
      });
      setItems(data.items);
      setTotalCount(data.total_count);
      setTotalPages(Math.ceil(data.total_count / pageSize));
    } catch (err) {
      console.error('Failed to load sprint items:', err);
    } finally {
      setItemsLoading(false);
    }
  }, [sprintId, page]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Build task URL with sprint context (must be before early returns for hook rules)
  const buildItemUrl = useMemo(
    () => (itemId: string) => `/dashboard/pm/tasks/${itemId}?from=sprint&sprintId=${sprintId}`,
    [sprintId]
  );

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteSprint(sprintId);
      router.push('/dashboard/pm/sprints');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sprint');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/pm/sprints"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sprints
          </Link>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !detail) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/pm/sprints"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sprints
          </Link>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">
            {error || 'Sprint not found.'}
          </p>
        </div>
      </div>
    );
  }

  const { sprint, metrics } = detail;
  const progress =
    metrics.total_items > 0
      ? Math.round((metrics.completed_items / metrics.total_items) * 100)
      : 0;

  // Status breakdown for the progress section
  const statusBreakdown: {
    label: string;
    count: number;
    icon: typeof CheckCircle2;
    color: string;
  }[] = [
    {
      label: 'Completed',
      count: metrics.completed_items,
      icon: CheckCircle2,
      color: 'text-green-500',
    },
    {
      label: 'In Progress',
      count: metrics.in_progress_items,
      icon: Clock,
      color: 'text-blue-500',
    },
    {
      label: 'Remaining',
      count: Math.max(
        0,
        metrics.total_items -
          metrics.completed_items -
          metrics.in_progress_items
      ),
      icon: AlertCircle,
      color: 'text-gray-400',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Navigation */}
      <div className="mb-6">
        <Link
          href="/dashboard/pm/sprints"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sprints
        </Link>

        {/* Sprint Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                <InlineEditText
                  value={sprint.name}
                  placeholder="Sprint name..."
                  onSave={async (newValue) => {
                    if (!newValue) return;
                    await updateSprintField(sprintId, 'name', newValue);
                    loadDetail(false);
                  }}
                  displayClassName="text-2xl font-bold text-gray-900"
                />
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${SPRINT_STATUS_COLORS[sprint.status]}`}
              >
                {SPRINT_STATUS_LABELS[sprint.status]}
              </span>
            </div>
            <div className="mt-2 flex items-start gap-1">
              <Target className="h-4 w-4 flex-shrink-0 text-gray-500 mt-0.5" />
              <InlineEditText
                value={sprint.goal}
                placeholder="Add a sprint goal..."
                multiline
                onSave={async (newValue) => {
                  await updateSprintField(sprintId, 'goal', newValue);
                  loadDetail(false);
                }}
                displayClassName="text-sm text-gray-500"
                rows={2}
              />
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <input
                type="date"
                value={sprint.start_date ? sprint.start_date.slice(0, 10) : ''}
                onChange={async (e) => {
                  const val = e.target.value;
                  await updateSprintField(sprintId, 'start_date', val || null);
                  loadDetail(false);
                }}
                className="border border-gray-200 rounded px-2 py-0.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                title="Start date"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={sprint.end_date ? sprint.end_date.slice(0, 10) : ''}
                onChange={async (e) => {
                  const val = e.target.value;
                  await updateSprintField(sprintId, 'end_date', val || null);
                  loadDetail(false);
                }}
                className="border border-gray-200 rounded px-2 py-0.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                title="End date"
              />
            </div>
          </div>
          {hasPermission(PERMISSIONS.PM_ADMIN) && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
              title="Delete sprint"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-sm text-red-800">
            Are you sure you want to delete sprint &quot;{sprint.name}&quot;? This will soft-delete the sprint.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1 text-sm text-gray-700 bg-white border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Progress Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <DualProgressBar
          completed={metrics.completed_items}
          total={metrics.total_items}
          byStatus={sprint.item_counts}
          estTokens={metrics.total_est_tokens}
          actualTokens={metrics.total_actual_tokens}
        />
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
          {statusBreakdown.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${item.color}`} />
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {item.count}
                  </div>
                  <div className="text-xs text-gray-500">{item.label}</div>
                </div>
              </div>
            );
          })}
        </div>
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
                {formatTokens(metrics.total_est_tokens)}
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
                {formatTokens(metrics.total_actual_tokens)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            {(() => {
              const variance =
                metrics.total_est_tokens > 0
                  ? ((metrics.total_actual_tokens - metrics.total_est_tokens) /
                      metrics.total_est_tokens) *
                    100
                  : 0;
              const isOver = variance > 0;
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
                    <div className="flex items-center gap-1">
                      <p className="text-sm text-gray-500">Variance</p>
                      <span className="group relative">
                        <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          (Actual − Estimated) / Estimated × 100
                        </span>
                      </span>
                    </div>
                    <p
                      className={`text-2xl font-bold ${isOver ? 'text-red-600' : 'text-green-600'}`}
                    >
                      {isOver ? '+' : ''}
                      {variance.toFixed(0)}%
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            {(() => {
              const SCOPE_CREEP_RED_THRESHOLD = 4;
              const original = sprint.original_item_count ?? metrics.total_items;
              const added = metrics.total_items - original;
              const pct = original > 0 ? Math.round((added / original) * 100) : 0;
              const hasCreep = added > 0;
              const isSevere = added >= SCOPE_CREEP_RED_THRESHOLD;
              return (
                <>
                  <div className={`p-2 rounded-lg ${hasCreep ? (isSevere ? 'bg-red-50' : 'bg-yellow-50') : 'bg-green-50'}`}>
                    <TrendingUp className={`h-5 w-5 ${hasCreep ? (isSevere ? 'text-red-600' : 'text-yellow-600') : 'text-green-600'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <p className="text-sm text-gray-500">Scope Change</p>
                      <span className="group relative">
                        <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          Items added after sprint started vs original count
                        </span>
                      </span>
                    </div>
                    <p className={`text-2xl font-bold ${hasCreep ? (isSevere ? 'text-red-600' : 'text-yellow-600') : 'text-green-600'}`}>
                      {added > 0 ? '+' : ''}{added} ({pct}%)
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Sprint Items Table */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Sprint Items ({totalCount})
        </h2>
        <TaskTable
          items={items}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          onPageChange={setPage}
          loading={itemsLoading}
          buildItemUrl={buildItemUrl}
        />
      </div>
    </div>
  );
}
