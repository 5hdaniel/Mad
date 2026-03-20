'use client';

/**
 * DiagnosticsPanel - Inline diagnostics display for admin ticket detail view
 * TASK-2283: Renders diagnostic data as collapsible key-value pairs.
 *
 * Supports both desktop app diagnostics (app_version, db_status, etc.)
 * and broker portal diagnostics (user_agent, viewport, screen, etc.).
 *
 * Visual pattern adapted from src/components/support/DiagnosticsPreview.tsx
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Cpu } from 'lucide-react';

interface DiagnosticsPanelProps {
  diagnostics: Record<string, unknown> | null;
}

/**
 * Format a diagnostics key from snake_case to a human-readable label.
 * e.g. "app_version" -> "App Version", "db_initialized" -> "DB Initialized"
 */
function formatLabel(key: string): string {
  return key
    .split('_')
    .map((word) => {
      // Keep common abbreviations uppercase
      if (['db', 'os', 'id', 'url', 'ip'].includes(word.toLowerCase())) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Format a diagnostics value for display.
 * Handles primitives, arrays, and nested objects.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    // For arrays of objects (like recent_errors), show count
    if (typeof value[0] === 'object') return `${value.length} item${value.length === 1 ? '' : 's'}`;
    return value.join(', ');
  }
  if (typeof value === 'object') {
    // Flatten simple objects into a readable string
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return 'N/A';
    return entries
      .map(([k, v]) => `${formatLabel(k)}: ${formatValue(v)}`)
      .join(', ');
  }
  return String(value);
}

export function DiagnosticsPanel({ diagnostics }: DiagnosticsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!diagnostics) {
    return (
      <div className="text-sm text-gray-500 italic py-2">
        No diagnostics attached
      </div>
    );
  }

  const entries = Object.entries(diagnostics);

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-blue-500" />
          <span>Diagnostics</span>
          <span className="text-xs text-gray-400 font-normal">
            ({entries.length} field{entries.length === 1 ? '' : 's'})
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 p-3">
          <div className="space-y-2 text-xs font-mono">
            {entries.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4">
                <span className="text-gray-500 flex-shrink-0">{formatLabel(key)}:</span>
                <span className="text-gray-800 truncate text-right" title={formatValue(value)}>
                  {formatValue(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
