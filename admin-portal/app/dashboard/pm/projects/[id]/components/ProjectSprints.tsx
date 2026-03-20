'use client';

/**
 * ProjectSprints -- Sprint creation and status summary for project detail page.
 *
 * Contains:
 * - InlineSprintCreate: "+ Create new sprint" form
 * - StatusSummary: Progress bar and status badges for the project
 * - TokenMetricCards: Token estimation/actual metric cards
 */

import { useState } from 'react';
import {
  Plus,
  Coins,
  TrendingUp,
  TrendingDown,
  Calendar,
  Info,
} from 'lucide-react';
import { createSprint } from '@/lib/pm-queries';
import type { PmProject, ItemStatus } from '@/lib/pm-types';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/pm-types';
import { DualProgressBar } from '../../../components/DualProgressBar';
import { formatTokens } from '@/lib/pm-utils';

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
// InlineSprintCreate -- "+ Create new sprint" row
// ---------------------------------------------------------------------------

interface InlineSprintCreateProps {
  projectId: string;
  onCreated: () => void;
}

export function InlineSprintCreate({ projectId, onCreated }: InlineSprintCreateProps) {
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
        } catch (err) {
          console.error('Failed to create:', err);
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
          onClick={() => { setAdding(false); setName(''); setGoal(''); }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// StatusSummary -- Progress bar and status badges
// ---------------------------------------------------------------------------

interface StatusSummaryProps {
  itemsByStatus: Record<string, number>;
  tokenSums: { estTotal: number; actualTotal: number; variance: number };
}

export function StatusSummary({ itemsByStatus, tokenSums }: StatusSummaryProps) {
  const totalItems = Object.values(itemsByStatus).reduce((a, b) => a + b, 0);
  const completedItems = itemsByStatus['completed'] ?? 0;

  return (
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
  );
}

// ---------------------------------------------------------------------------
// TokenMetricCards -- Token estimation/actual metric cards
// ---------------------------------------------------------------------------

interface TokenMetricCardsProps {
  tokenSums: { estTotal: number; actualTotal: number; variance: number };
  project: PmProject;
}

export function TokenMetricCards({ tokenSums, project }: TokenMetricCardsProps) {
  return (
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
  );
}
