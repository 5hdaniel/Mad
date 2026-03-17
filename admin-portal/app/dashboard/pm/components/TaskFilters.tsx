'use client';

/**
 * TaskFilters - PM Backlog
 *
 * Filter controls for the backlog list: Status, Priority, Type, Area, Sprint, Project.
 */

import { useEffect, useState } from 'react';
import { Filter, X } from 'lucide-react';
import { listSprints, listProjects } from '@/lib/pm-queries';
import type { ItemStatus, ItemPriority, ItemType, PmSprint, PmProject } from '@/lib/pm-types';
import { STATUS_LABELS, PRIORITY_LABELS, TYPE_LABELS } from '@/lib/pm-types';

const AREA_OPTIONS = [
  'admin-portal',
  'electron',
  'broker-portal',
  'service',
  'schema',
  'ui',
];

interface TaskFiltersProps {
  status: ItemStatus | null;
  priority: ItemPriority | null;
  type: ItemType | null;
  area: string | null;
  sprintId: string | null;
  projectId: string | null;
  onStatusChange: (status: ItemStatus | null) => void;
  onPriorityChange: (priority: ItemPriority | null) => void;
  onTypeChange: (type: ItemType | null) => void;
  onAreaChange: (area: string | null) => void;
  onSprintChange: (sprintId: string | null) => void;
  onProjectChange: (projectId: string | null) => void;
}

export function TaskFilters({
  status,
  priority,
  type,
  area,
  sprintId,
  projectId,
  onStatusChange,
  onPriorityChange,
  onTypeChange,
  onAreaChange,
  onSprintChange,
  onProjectChange,
}: TaskFiltersProps) {
  const [sprints, setSprints] = useState<PmSprint[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);

  useEffect(() => {
    listSprints().then(setSprints).catch(() => {});
    listProjects().then(setProjects).catch(() => {});
  }, []);

  const hasFilters = status || priority || type || area || sprintId || projectId;

  function clearAll() {
    onStatusChange(null);
    onPriorityChange(null);
    onTypeChange(null);
    onAreaChange(null);
    onSprintChange(null);
    onProjectChange(null);
  }

  const selectClass =
    'text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 text-gray-500">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Filters</span>
      </div>

      {/* Status filter */}
      <select
        value={status || ''}
        onChange={(e) => onStatusChange((e.target.value as ItemStatus) || null)}
        className={selectClass}
      >
        <option value="">All Statuses</option>
        {(Object.entries(STATUS_LABELS) as [ItemStatus, string][]).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      {/* Priority filter */}
      <select
        value={priority || ''}
        onChange={(e) => onPriorityChange((e.target.value as ItemPriority) || null)}
        className={selectClass}
      >
        <option value="">All Priorities</option>
        {(Object.entries(PRIORITY_LABELS) as [ItemPriority, string][]).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      {/* Type filter */}
      <select
        value={type || ''}
        onChange={(e) => onTypeChange((e.target.value as ItemType) || null)}
        className={selectClass}
      >
        <option value="">All Types</option>
        {(Object.entries(TYPE_LABELS) as [ItemType, string][]).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      {/* Area filter */}
      <select
        value={area || ''}
        onChange={(e) => onAreaChange(e.target.value || null)}
        className={selectClass}
      >
        <option value="">All Areas</option>
        {AREA_OPTIONS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      {/* Sprint filter */}
      <select
        value={sprintId || ''}
        onChange={(e) => onSprintChange(e.target.value || null)}
        className={selectClass}
      >
        <option value="">All Sprints</option>
        {sprints.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {/* Project filter */}
      <select
        value={projectId || ''}
        onChange={(e) => onProjectChange(e.target.value || null)}
        className={selectClass}
      >
        <option value="">All Projects</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {/* Clear all button */}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}
