'use client';

/**
 * Project Detail Page - /dashboard/pm/projects/[id]
 *
 * Shows project info, item status breakdown with progress bar,
 * items table (filtered to this project), and associated sprints.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FolderKanban } from 'lucide-react';
import { getProjectDetail, listItems } from '@/lib/pm-queries';
import { TaskTable } from '../../components/TaskTable';
import { SprintList } from '../../components/SprintList';
import type { PmProject, PmBacklogItem, PmSprint, ItemStatus } from '@/lib/pm-types';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/pm-types';

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

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  // Project detail state
  const [project, setProject] = useState<PmProject | null>(null);
  const [sprints, setSprints] = useState<PmSprint[]>([]);
  const [itemsByStatus, setItemsByStatus] = useState<Record<string, number>>({});
  const [loadingDetail, setLoadingDetail] = useState(true);

  // Items table state
  const [items, setItems] = useState<PmBacklogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingItems, setLoadingItems] = useState(true);

  const pageSize = 25;

  // Load project detail
  useEffect(() => {
    async function loadDetail() {
      setLoadingDetail(true);
      try {
        const data = await getProjectDetail(projectId);
        setProject(data.project);
        setSprints(data.sprints);
        setItemsByStatus(data.items_by_status);
      } catch (err) {
        console.error('Failed to load project detail:', err);
      } finally {
        setLoadingDetail(false);
      }
    }
    loadDetail();
  }, [projectId]);

  // Load items for this project
  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const data = await listItems({
        project_id: projectId,
        page,
        page_size: pageSize,
      });
      setItems(data.items);
      setTotalCount(data.total_count);
      setTotalPages(Math.ceil(data.total_count / pageSize));
    } catch (err) {
      console.error('Failed to load project items:', err);
    } finally {
      setLoadingItems(false);
    }
  }, [projectId, page]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Build task URL with project context
  const buildItemUrl = useMemo(
    () => (itemId: string) => `/dashboard/pm/tasks/${itemId}?from=project&projectId=${projectId}`,
    [projectId]
  );

  // Compute total and progress from itemsByStatus
  const totalItems = Object.values(itemsByStatus).reduce((a, b) => a + b, 0);
  const completedItems = itemsByStatus['completed'] ?? 0;
  const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

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
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
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
              <p className="text-sm text-gray-500 mt-1">{project.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Status summary with progress bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Status Summary</h2>
          <span className="text-sm text-gray-500">{progressPct}% complete</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Status badges */}
        {totalItems > 0 ? (
          <div className="flex flex-wrap gap-3">
            {STATUS_ORDER.filter((s) => (itemsByStatus[s] ?? 0) > 0).map((status) => (
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
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No items in this project yet.</p>
        )}
      </div>

      {/* Items section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Items
          <span className="ml-2 text-sm font-normal text-gray-500">({totalCount})</span>
        </h2>
        <TaskTable
          items={items}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          onPageChange={setPage}
          loading={loadingItems}
          buildItemUrl={buildItemUrl}
        />
      </div>

      {/* Sprints section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Sprints
          <span className="ml-2 text-sm font-normal text-gray-500">({sprints.length})</span>
        </h2>
        <SprintList sprints={sprints} />
      </div>
    </div>
  );
}
