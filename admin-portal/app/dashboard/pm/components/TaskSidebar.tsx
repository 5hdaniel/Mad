'use client';

/**
 * TaskSidebar - PM Item Detail
 *
 * Right sidebar showing item metadata and editable fields:
 * status, priority, type, area, sprint, project, assignee,
 * estimated/actual tokens, dates, labels, timestamps, and legacy ID.
 * Adapted from support TicketSidebar with additional PM-specific fields.
 */

import { useState, useEffect, useCallback } from 'react';
import { Calendar, AlertCircle, Tag } from 'lucide-react';
import {
  updateItemStatus,
  updateItemField,
  assignItem,
  assignToSprint,
  removeFromSprint,
  listSprints,
  listProjects,
} from '@/lib/pm-queries';
import { getAssignableAgents } from '@/lib/support-queries';
import type { AssignableAgent } from '@/lib/support-queries';
import type {
  PmBacklogItem,
  PmSprint,
  PmProject,
  ItemStatus,
  ItemPriority,
  ItemType,
} from '@/lib/pm-types';
import {
  ALLOWED_TRANSITIONS,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  TYPE_LABELS,
} from '@/lib/pm-types';

// -- Props -------------------------------------------------------------------

interface TaskSidebarProps {
  item: PmBacklogItem;
  onUpdate: () => void;
}

// -- Helpers -----------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Parse a date string as local date (not UTC) to avoid timezone shifts */
function parseLocalDate(dateStr: string): Date {
  // "2026-03-17" or "2026-03-17T..." → treat as local midnight
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateShort(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isOverdue(dueDate: string | null, status: ItemStatus): boolean {
  if (!dueDate) return false;
  if (status === 'completed' || status === 'obsolete') return false;
  const due = parseLocalDate(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

// -- Component ---------------------------------------------------------------

export function TaskSidebar({ item, onUpdate }: TaskSidebarProps) {
  // Dropdown options loaded on mount
  const [agents, setAgents] = useState<AssignableAgent[]>([]);
  const [sprints, setSprints] = useState<PmSprint[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);

  // Field-level loading states
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [updatingType, setUpdatingType] = useState(false);
  const [updatingArea, setUpdatingArea] = useState(false);
  const [updatingSprint, setUpdatingSprint] = useState(false);
  const [updatingProject, setUpdatingProject] = useState(false);
  const [updatingAssignee, setUpdatingAssignee] = useState(false);
  const [updatingEstTokens, setUpdatingEstTokens] = useState(false);
  const [updatingStartDate, setUpdatingStartDate] = useState(false);
  const [updatingDueDate, setUpdatingDueDate] = useState(false);

  // Selected values for controlled fields
  const [selectedStatus, setSelectedStatus] = useState<ItemStatus | ''>('');
  const [areaValue, setAreaValue] = useState(item.area || '');
  const [estTokensValue, setEstTokensValue] = useState(
    item.est_tokens != null ? String(item.est_tokens) : '',
  );
  const [startDateValue, setStartDateValue] = useState(
    item.start_date ? item.start_date.split('T')[0] : '',
  );
  const [dueDateValue, setDueDateValue] = useState(
    item.due_date ? item.due_date.split('T')[0] : '',
  );

  const [error, setError] = useState<string | null>(null);

  // Load dropdown options on mount
  useEffect(() => {
    getAssignableAgents().then(setAgents).catch(() => {});
    listSprints().then(setSprints).catch(() => {});
    listProjects().then(setProjects).catch(() => {});
  }, []);

  // Sync local state when item changes
  useEffect(() => {
    setAreaValue(item.area || '');
    setEstTokensValue(item.est_tokens != null ? String(item.est_tokens) : '');
    setStartDateValue(item.start_date ? item.start_date.split('T')[0] : '');
    setDueDateValue(item.due_date ? item.due_date.split('T')[0] : '');
  }, [item]);

  const allowedTransitions = ALLOWED_TRANSITIONS[item.status] || [];

  // -- Handlers ---------------------------------------------------------------

  const handleStatusChange = useCallback(async () => {
    if (!selectedStatus) return;
    setUpdatingStatus(true);
    setError(null);
    try {
      await updateItemStatus(item.id, selectedStatus);
      setSelectedStatus('');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  }, [selectedStatus, item.id, onUpdate]);

  const handlePriorityChange = useCallback(
    async (value: string) => {
      if (value === item.priority) return;
      setUpdatingPriority(true);
      setError(null);
      try {
        await updateItemField(item.id, 'priority', value);
        onUpdate();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update priority');
      } finally {
        setUpdatingPriority(false);
      }
    },
    [item.id, item.priority, onUpdate],
  );

  const handleTypeChange = useCallback(
    async (value: string) => {
      if (value === item.type) return;
      setUpdatingType(true);
      setError(null);
      try {
        await updateItemField(item.id, 'type', value);
        onUpdate();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update type');
      } finally {
        setUpdatingType(false);
      }
    },
    [item.id, item.type, onUpdate],
  );

  const handleAreaSave = useCallback(async () => {
    const trimmed = areaValue.trim();
    if (trimmed === (item.area || '')) return;
    setUpdatingArea(true);
    setError(null);
    try {
      await updateItemField(item.id, 'area', trimmed || null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update area');
    } finally {
      setUpdatingArea(false);
    }
  }, [areaValue, item.id, item.area, onUpdate]);

  const handleSprintChange = useCallback(
    async (sprintId: string) => {
      setUpdatingSprint(true);
      setError(null);
      try {
        if (sprintId) {
          await assignToSprint([item.id], sprintId);
        } else {
          await removeFromSprint([item.id]);
        }
        onUpdate();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update sprint');
      } finally {
        setUpdatingSprint(false);
      }
    },
    [item.id, onUpdate],
  );

  const handleProjectChange = useCallback(
    async (projectId: string) => {
      if (projectId === (item.project_id || '')) return;
      setUpdatingProject(true);
      setError(null);
      try {
        await updateItemField(item.id, 'project_id', projectId || null);
        onUpdate();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update project');
      } finally {
        setUpdatingProject(false);
      }
    },
    [item.id, item.project_id, onUpdate],
  );

  const handleAssigneeChange = useCallback(
    async (assigneeId: string) => {
      if (assigneeId === (item.assignee_id || '')) return;
      setUpdatingAssignee(true);
      setError(null);
      try {
        await assignItem(item.id, assigneeId);
        onUpdate();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to assign item');
      } finally {
        setUpdatingAssignee(false);
      }
    },
    [item.id, item.assignee_id, onUpdate],
  );

  const handleEstTokensSave = useCallback(async () => {
    const numStr = estTokensValue.trim();
    const current = item.est_tokens != null ? String(item.est_tokens) : '';
    if (numStr === current) return;
    setUpdatingEstTokens(true);
    setError(null);
    try {
      await updateItemField(item.id, 'est_tokens', numStr || null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update est tokens');
    } finally {
      setUpdatingEstTokens(false);
    }
  }, [estTokensValue, item.id, item.est_tokens, onUpdate]);

  const handleStartDateSave = useCallback(async () => {
    const current = item.start_date ? item.start_date.split('T')[0] : '';
    if (startDateValue === current) return;
    setUpdatingStartDate(true);
    setError(null);
    try {
      await updateItemField(item.id, 'start_date', startDateValue || null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update start date');
    } finally {
      setUpdatingStartDate(false);
    }
  }, [startDateValue, item.id, item.start_date, onUpdate]);

  const handleDueDateSave = useCallback(async () => {
    const current = item.due_date ? item.due_date.split('T')[0] : '';
    if (dueDateValue === current) return;
    setUpdatingDueDate(true);
    setError(null);
    try {
      await updateItemField(item.id, 'due_date', dueDateValue || null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update due date');
    } finally {
      setUpdatingDueDate(false);
    }
  }, [dueDateValue, item.id, item.due_date, onUpdate]);

  const overdue = isOverdue(item.due_date, item.status);

  return (
    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200 overflow-y-auto">
      {/* Error display */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        </div>
      )}

      {/* Status */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Status
        </label>
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status]}`}
          >
            {STATUS_LABELS[item.status]}
          </span>
        </div>
        {allowedTransitions.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ItemStatus)}
              className="flex-1 text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Change status...</option>
              {allowedTransitions.map((nextStatus) => (
                <option key={nextStatus} value={nextStatus}>
                  {STATUS_LABELS[nextStatus]}
                </option>
              ))}
            </select>
            <button
              onClick={handleStatusChange}
              disabled={!selectedStatus || updatingStatus}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updatingStatus ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Priority */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Priority
        </label>
        <select
          value={item.priority}
          onChange={(e) => handlePriorityChange(e.target.value)}
          disabled={updatingPriority}
          className="w-full text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {(Object.entries(PRIORITY_LABELS) as [ItemPriority, string][]).map(
            ([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ),
          )}
        </select>
      </div>

      {/* Type */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Type
        </label>
        <select
          value={item.type}
          onChange={(e) => handleTypeChange(e.target.value)}
          disabled={updatingType}
          className="w-full text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {(Object.entries(TYPE_LABELS) as [ItemType, string][]).map(
            ([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ),
          )}
        </select>
      </div>

      {/* Area */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Area
        </label>
        <input
          type="text"
          value={areaValue}
          onChange={(e) => setAreaValue(e.target.value)}
          onBlur={handleAreaSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAreaSave();
          }}
          placeholder="e.g. auth, billing"
          disabled={updatingArea}
          className="w-full text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      {/* Sprint */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Sprint
        </label>
        <select
          value={item.sprint_id || ''}
          onChange={(e) => handleSprintChange(e.target.value)}
          disabled={updatingSprint}
          className="w-full text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">No sprint</option>
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.status})
            </option>
          ))}
        </select>
      </div>

      {/* Project */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Project
        </label>
        <select
          value={item.project_id || ''}
          onChange={(e) => handleProjectChange(e.target.value)}
          disabled={updatingProject}
          className="w-full text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Assignee */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Assignee
        </label>
        <div className="flex items-center gap-2">
          <select
            value={item.assignee_id || ''}
            onChange={(e) => handleAssigneeChange(e.target.value)}
            disabled={updatingAssignee}
            className="flex-1 text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">Unassigned</option>
            {agents.map((agent) => (
              <option key={agent.user_id} value={agent.user_id}>
                {agent.display_name} ({agent.role_name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Est Tokens */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Est. Tokens
        </label>
        <input
          type="number"
          value={estTokensValue}
          onChange={(e) => setEstTokensValue(e.target.value)}
          onBlur={handleEstTokensSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleEstTokensSave();
          }}
          placeholder="0"
          disabled={updatingEstTokens}
          className="w-full text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      {/* Actual Tokens (read-only) */}
      {item.actual_tokens != null && (
        <div className="px-4 py-3">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
            Actual Tokens
          </label>
          <div className="text-sm text-gray-700">
            {item.actual_tokens.toLocaleString()}
            {item.variance != null && (
              <span
                className={`ml-2 text-xs ${
                  item.variance > 0 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                ({item.variance > 0 ? '+' : ''}
                {item.variance}%)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Start Date */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Start Date
        </label>
        <input
          type="date"
          value={startDateValue}
          onChange={(e) => {
            setStartDateValue(e.target.value);
          }}
          onBlur={handleStartDateSave}
          disabled={updatingStartDate}
          className="w-full text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      {/* Due Date */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Due Date
        </label>
        <input
          type="date"
          value={dueDateValue}
          onChange={(e) => {
            setDueDateValue(e.target.value);
          }}
          onBlur={handleDueDateSave}
          disabled={updatingDueDate}
          className={`w-full text-sm border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${
            overdue
              ? 'text-red-700 border-red-300'
              : 'text-gray-900 border-gray-300'
          }`}
        />
        {overdue && (
          <div className="mt-1 text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Overdue
          </div>
        )}
      </div>

      {/* Labels (read-only display) */}
      {item.labels && item.labels.length > 0 && (
        <div className="px-4 py-3">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
            Labels
          </label>
          <div className="flex flex-wrap gap-1.5">
            {item.labels.map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Item Number */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Item ID
        </label>
        <div className="flex items-center gap-1.5 text-sm text-gray-700">
          <Tag className="h-3.5 w-3.5 text-gray-400" />
          #{item.item_number}
        </div>
      </div>

      {/* Timestamps */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Dates
        </label>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="h-3 w-3" />
            Created: {formatDate(item.created_at)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="h-3 w-3" />
            Updated: {formatDate(item.updated_at)}
          </div>
          {item.completed_at && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar className="h-3 w-3" />
              Completed: {formatDate(item.completed_at)}
            </div>
          )}
          {item.start_date && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar className="h-3 w-3" />
              Starts: {formatDateShort(item.start_date)}
            </div>
          )}
          {item.due_date && (
            <div
              className={`flex items-center gap-1.5 text-xs ${
                overdue ? 'text-red-600' : 'text-gray-500'
              }`}
            >
              <Calendar className="h-3 w-3" />
              Due: {formatDateShort(item.due_date)}
            </div>
          )}
        </div>
      </div>

      {/* Duplicate "Item ID" section removed -- already shown above under "Item ID" */}
    </div>
  );
}
