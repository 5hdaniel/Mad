'use client';

/**
 * Sprint Detail Page - /dashboard/pm/sprints/[id]
 *
 * Shows full sprint information: header with status badge, goal, date range,
 * item progress breakdown, burndown chart, est vs actual chart,
 * and a paginated task table of sprint items.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Target,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Coins,
  TrendingUp,
  TrendingDown,
  Gauge,
} from 'lucide-react';
import { getSprintDetail, listItems } from '@/lib/pm-queries';
import type {
  PmSprint,
  PmBacklogItem,
  SprintDetailResponse,
  ItemStatus,
} from '@/lib/pm-types';
import { SPRINT_STATUS_LABELS, SPRINT_STATUS_COLORS } from '@/lib/pm-types';
import { BurndownChart } from '../../components/BurndownChart';
import type { BurndownDataPoint } from '../../components/BurndownChart';
import { EstVsActualChart } from '../../components/EstVsActualChart';
import type { EstVsActualEntry } from '../../components/EstVsActualChart';
import { TaskTable } from '../../components/TaskTable';

/** Format token count for display (e.g. 1500 → "2K", 1200000 → "1.2M"). */
function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
  return String(tokens);
}

/** Build simplified burndown data from sprint date range and current state. */
function buildBurndownData(
  sprint: PmSprint,
  totalItems: number,
  completedItems: number
): BurndownDataPoint[] {
  if (!sprint.start_date || !sprint.end_date || totalItems === 0) return [];

  const start = new Date(sprint.start_date);
  const end = new Date(sprint.end_date);
  const today = new Date();
  const totalDays = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  );

  const points: BurndownDataPoint[] = [];
  const remaining = totalItems - completedItems;

  // Build ideal line from start to end
  for (let d = 0; d <= totalDays; d++) {
    const date = new Date(start);
    date.setDate(date.getDate() + d);
    if (date > today && sprint.status !== 'completed') break;

    const ideal = Math.round(totalItems * (1 - d / totalDays));
    const dateLabel = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    // For actual, we only know the current state -- show linear progress to today
    const dayProgress = Math.min(d / totalDays, 1);
    const estimatedActual =
      d === 0
        ? totalItems
        : date >= today
          ? remaining
          : Math.round(totalItems - (totalItems - remaining) * dayProgress);

    points.push({
      date: dateLabel,
      remaining: estimatedActual,
      ideal,
    });
  }

  return points;
}

/** Build est vs actual chart data from sprint items. */
function buildEstVsActualData(items: PmBacklogItem[]): EstVsActualEntry[] {
  return items
    .filter((item) => item.est_tokens || item.actual_tokens)
    .slice(0, 20) // Limit to 20 items for readability
    .map((item) => ({
      name:
        item.legacy_id ||
        (item.title.length > 20
          ? item.title.substring(0, 20) + '...'
          : item.title),
      estimated: Math.round((item.est_tokens || 0) / 1000),
      actual: Math.round((item.actual_tokens || 0) / 1000),
    }));
}

export default function SprintDetailPage() {
  const params = useParams();
  const sprintId = params.id as string;

  const [detail, setDetail] = useState<SprintDetailResponse | null>(null);
  const [items, setItems] = useState<PmBacklogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 50;

  // Load sprint detail
  useEffect(() => {
    if (!sprintId) return;

    async function loadDetail() {
      setLoading(true);
      setError(null);
      try {
        const data = await getSprintDetail(sprintId);
        setDetail(data);
      } catch (err) {
        console.error('Failed to load sprint detail:', err);
        setError('Failed to load sprint detail.');
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [sprintId]);

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

  // Build chart data
  const burndownData = buildBurndownData(
    sprint,
    metrics.total_items,
    metrics.completed_items
  );
  const estVsActualData = buildEstVsActualData(items);

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
                {sprint.name}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${SPRINT_STATUS_COLORS[sprint.status]}`}
              >
                {SPRINT_STATUS_LABELS[sprint.status]}
              </span>
            </div>
            {sprint.goal && (
              <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                <Target className="h-4 w-4 flex-shrink-0" />
                {sprint.goal}
              </p>
            )}
            {(sprint.start_date || sprint.end_date) && (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                {sprint.start_date
                  ? new Date(sprint.start_date).toLocaleDateString()
                  : '?'}
                {' - '}
                {sprint.end_date
                  ? new Date(sprint.end_date).toLocaleDateString()
                  : '?'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Progress</h2>
          <span className="text-sm font-medium text-gray-700">
            {metrics.completed_items}/{metrics.total_items} items ({progress}%)
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
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
                    <p className="text-sm text-gray-500">Variance</p>
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
            <div className="p-2 rounded-lg bg-green-50">
              <Gauge className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Efficiency</p>
              <p className="text-2xl font-bold text-gray-900">{progress}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {(burndownData.length > 0 || estVsActualData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <BurndownChart
            data={burndownData}
            totalItems={metrics.total_items}
          />
          <EstVsActualChart data={estVsActualData} />
        </div>
      )}

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
        />
      </div>
    </div>
  );
}
