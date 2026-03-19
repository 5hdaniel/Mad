'use client';

/**
 * Project Detail Page - /dashboard/pm/projects/[id]
 *
 * Composition root that assembles:
 * - ProjectHeader (name, description, delete)
 * - StatusSummary (progress bar, status badges)
 * - TokenMetricCards (est/actual/variance/days)
 * - BacklogPanel + SprintSections (responsive layout)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getProjectDetail,
  listItems,
  updateProjectField,
  deleteProject,
} from '@/lib/pm-queries';
import type {
  PmProject,
  PmBacklogItem,
  PmSprint,
  SprintStatus,
  ProjectField,
} from '@/lib/pm-types';
import { ProjectHeader, DeleteConfirmation, ProjectLoadingSkeleton, ProjectNotFound } from './components/ProjectHeader';
import { StatusSummary, TokenMetricCards, InlineSprintCreate } from './components/ProjectSprints';
import { BacklogPanel, SprintSection } from './components/ProjectTasks';

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Project detail state
  const [project, setProject] = useState<PmProject | null>(null);
  const [sprints, setSprints] = useState<PmSprint[]>([]);
  const [itemsByStatus, setItemsByStatus] = useState<Record<string, number>>({});
  const [loadingDetail, setLoadingDetail] = useState(true);

  // All items for backlog + token sums
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
    } catch (err) {
      console.error('Failed to load project data:', err);
    } finally {
      setLoadingDetail(false);
    }
  }, [projectId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  // Load ALL items for this project
  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const data = await listItems({ project_id: projectId, page_size: 500 });
      setAllItems(data.items);
    } catch (err) {
      console.error('Failed to load project data:', err);
    } finally {
      setLoadingItems(false);
    }
  }, [projectId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // Filter to unassigned items (no sprint_id)
  const backlogItems = useMemo(
    () => allItems.filter((item) => !item.sprint_id),
    [allItems]
  );

  // Token sums
  const tokenSums = useMemo(() => {
    let estTotal = 0;
    let actualTotal = 0;
    for (const item of allItems) {
      estTotal += item.est_tokens ?? 0;
      actualTotal += item.actual_tokens ?? 0;
    }
    const variance = estTotal > 0 ? ((actualTotal - estTotal) / estTotal) * 100 : 0;
    return { estTotal, actualTotal, variance };
  }, [allItems]);

  // Sort sprints: active first, then planned, then completed, then cancelled
  const sortedSprints = useMemo(() => {
    const order: Record<SprintStatus, number> = {
      active: 0, planned: 1, completed: 2, cancelled: 3,
    };
    return [...sprints].sort(
      (a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99)
    );
  }, [sprints]);

  const refreshAll = useCallback(() => {
    loadDetail();
    loadItems();
  }, [loadDetail, loadItems]);

  // Update project field handler
  const handleUpdateField = useCallback(async (field: ProjectField, value: string | null) => {
    await updateProjectField(projectId, field, value);
    loadDetail();
  }, [projectId, loadDetail]);

  // Delete project handler
  async function handleDeleteProject() {
    setDeleting(true);
    try {
      await deleteProject(projectId);
      router.push('/dashboard/pm/projects');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete project');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  // Loading / not found states
  if (loadingDetail) return <ProjectLoadingSkeleton />;
  if (!project) return <ProjectNotFound />;

  return (
    <div className="max-w-7xl mx-auto">
      <ProjectHeader
        project={project}
        projectId={projectId}
        onUpdateField={handleUpdateField}
        onDeleteRequest={() => setShowDeleteConfirm(true)}
      />

      {showDeleteConfirm && (
        <DeleteConfirmation
          projectName={project.name}
          deleting={deleting}
          deleteError={deleteError}
          onConfirm={handleDeleteProject}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {!showDeleteConfirm && deleteError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-sm text-red-800">{deleteError}</p>
        </div>
      )}

      <StatusSummary itemsByStatus={itemsByStatus} tokenSums={tokenSums} />

      <TokenMetricCards tokenSums={tokenSums} project={project} />

      {/* Responsive layout: Backlog panel + Sprint sections */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-1/3 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Backlog</h2>
            <span className="text-sm text-gray-500">({backlogItems.length})</span>
          </div>
          <BacklogPanel
            items={backlogItems}
            projectId={projectId}
            loading={loadingItems}
            onRefresh={refreshAll}
          />
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Sprints</h2>
            <span className="text-sm text-gray-500">({sortedSprints.length})</span>
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

          <InlineSprintCreate projectId={projectId} onCreated={refreshAll} />
        </div>
      </div>
    </div>
  );
}
