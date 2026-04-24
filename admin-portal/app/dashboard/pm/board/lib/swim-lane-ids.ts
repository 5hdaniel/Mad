/**
 * swim-lane-ids -- Pure helpers for encoding / decoding swim-lane droppable IDs.
 *
 * Kept free of JSX / React imports so they can be unit tested under the
 * vitest `*.test.ts` include pattern.
 *
 * Droppable id format (structured):
 *
 *   cell:dim=<project|area|assignee>:key=<groupKey>:status=<status>
 *
 * Ghost "new project" row drop target:
 *
 *   swimlane-new-project
 */

import type { ItemStatus } from '@/lib/pm-types';

export const SWIM_LANE_NEW_PROJECT_ID = 'swimlane-new-project';

export type SwimLaneDimension = 'project' | 'area' | 'assignee';

export interface ParsedSwimLaneCell {
  dimension: SwimLaneDimension;
  groupKey: string;
  status: ItemStatus;
}

/** Build a structured swim-lane cell droppable id. */
export function buildSwimLaneCellId(
  dimension: SwimLaneDimension,
  groupKey: string,
  status: ItemStatus
): string {
  return `cell:dim=${dimension}:key=${groupKey}:status=${status}`;
}

/** Valid column statuses that can appear in a swim-lane cell id. */
const VALID_STATUSES = new Set<string>([
  'pending',
  'in_progress',
  'testing',
  'waiting_for_user',
  'completed',
  'blocked',
  'deferred',
  'obsolete',
  'reopened',
]);

/** Parse a structured swim-lane cell droppable id, or null if not a cell id. */
export function parseSwimLaneCellId(overId: string): ParsedSwimLaneCell | null {
  if (!overId.startsWith('cell:')) return null;
  const match = overId.match(
    /^cell:dim=(project|area|assignee):key=(.*):status=([a-z_]+)$/
  );
  if (!match) return null;
  const [, dimension, groupKey, status] = match;
  if (!VALID_STATUSES.has(status)) return null;
  return {
    dimension: dimension as SwimLaneDimension,
    groupKey,
    status: status as ItemStatus,
  };
}
