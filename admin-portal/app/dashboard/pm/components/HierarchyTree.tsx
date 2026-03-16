'use client';

/**
 * HierarchyTree - PM Backlog Page
 *
 * Renders a tree view of backlog items with parent-child relationships.
 * Supports expand/collapse and lazy-loading children via listItems({ parent_id }).
 * Max depth: 4 levels.
 */

import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { listItems } from '@/lib/pm-queries';
import type { PmBacklogItem } from '@/lib/pm-types';
import { STATUS_COLORS } from '@/lib/pm-types';

interface HierarchyTreeProps {
  items: PmBacklogItem[]; // root-level items (parent_id = null)
  onItemClick: (itemId: string) => void;
}

const MAX_DEPTH = 4;

// Indentation classes per depth level
const INDENT_CLASSES: Record<number, string> = {
  0: 'pl-0',
  1: 'pl-4',
  2: 'pl-8',
  3: 'pl-12',
  4: 'pl-16',
};

export function HierarchyTree({ items, onItemClick }: HierarchyTreeProps) {
  // Track expanded nodes
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  // Track loaded children per node
  const [childrenMap, setChildrenMap] = useState<Record<string, PmBacklogItem[]>>({});
  // Track loading state per node
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback(
    async (item: PmBacklogItem) => {
      const id = item.id;
      const isExpanded = expandedNodes.has(id);

      if (isExpanded) {
        // Collapse
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        return;
      }

      // Expand -- load children if not already loaded
      if (!childrenMap[id] && (item.child_count ?? 0) > 0) {
        setLoadingNodes((prev) => new Set(prev).add(id));
        try {
          const response = await listItems({ parent_id: id, page_size: 100 });
          setChildrenMap((prev) => ({ ...prev, [id]: response.items }));
        } catch {
          // Silently fail; user can retry by collapsing/expanding
        } finally {
          setLoadingNodes((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      }

      setExpandedNodes((prev) => new Set(prev).add(id));
    },
    [expandedNodes, childrenMap]
  );

  function getStatusDotColor(status: string): string {
    const colorClass = (STATUS_COLORS as Record<string, string>)[status];
    if (!colorClass) return 'bg-gray-400';
    // Extract the bg color from the Tailwind class (e.g. "bg-blue-100 text-blue-800" -> "bg-blue-500")
    const match = colorClass.match(/text-(\w+)-(\d+)/);
    if (match) return `bg-${match[1]}-${match[2]}`;
    return 'bg-gray-400';
  }

  function renderNode(item: PmBacklogItem, depth: number) {
    if (depth > MAX_DEPTH) return null;

    const hasChildren = (item.child_count ?? 0) > 0;
    const isExpanded = expandedNodes.has(item.id);
    const isLoading = loadingNodes.has(item.id);
    const children = childrenMap[item.id] || [];
    const indentClass = INDENT_CLASSES[depth] || INDENT_CLASSES[MAX_DEPTH];

    return (
      <div key={item.id}>
        <div
          className={`flex items-center gap-1.5 py-1 hover:bg-gray-50 rounded-sm cursor-pointer ${indentClass}`}
        >
          {/* Expand/collapse toggle */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(item);
              }}
              className="p-0.5 text-gray-400 hover:text-gray-600"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="w-[22px]" /> // Spacer to align with items that have children
          )}

          {/* Status dot */}
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${getStatusDotColor(item.status)}`}
          />

          {/* Item content */}
          <button
            onClick={() => onItemClick(item.id)}
            className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
          >
            {item.legacy_id && (
              <span className="text-xs text-gray-400 font-mono shrink-0">
                [{item.legacy_id}]
              </span>
            )}
            <span className="text-sm text-gray-700 truncate">
              {item.title}
            </span>
          </button>

          {/* Child count badge */}
          {hasChildren && !isExpanded && (
            <span className="text-xs text-gray-400 shrink-0">
              {item.child_count} {item.child_count === 1 ? 'child' : 'children'}
            </span>
          )}
        </div>

        {/* Render children if expanded */}
        {isExpanded && children.length > 0 && (
          <div>
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-sm text-gray-400 py-4 text-center">
        No items to display
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {items.map((item) => renderNode(item, 0))}
    </div>
  );
}
