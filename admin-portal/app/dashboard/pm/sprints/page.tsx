'use client';

/**
 * Sprint List Page - /dashboard/pm/sprints
 *
 * Displays all sprints with toggle between list and card views.
 * Includes a velocity chart showing estimated vs actual tokens
 * across recent sprints.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, List, LayoutGrid } from 'lucide-react';
import { listSprints, getSprintVelocity } from '@/lib/pm-queries';
import type { PmSprint, SprintVelocityEntry } from '@/lib/pm-types';
import { SprintList } from '../components/SprintList';
import { SprintCard } from '../components/SprintCard';
import { VelocityChart } from '../components/VelocityChart';

type ViewMode = 'list' | 'card';
type StatusFilter = 'all' | 'active' | 'planned' | 'completed';

export default function SprintsPage() {
  const [sprints, setSprints] = useState<PmSprint[]>([]);
  const [velocityData, setVelocityData] = useState<SprintVelocityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sprintData, velocity] = await Promise.allSettled([
        listSprints(),
        getSprintVelocity(10),
      ]);

      if (sprintData.status === 'fulfilled') {
        setSprints(sprintData.value);
      } else {
        console.error('Failed to load sprints:', sprintData.reason);
      }

      if (velocity.status === 'fulfilled') {
        setVelocityData(velocity.value);
      }
      // Velocity chart is optional -- silently skip if RPC not available
    } catch (err) {
      console.error('Failed to load sprint data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter sprints by status
  const filteredSprints = statusFilter === 'all'
    ? sprints
    : sprints.filter((s) => s.status === statusFilter);

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'planned', label: 'Planned' },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Navigation */}
      <div className="mb-6">
        <Link
          href="/dashboard/pm"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sprints</h1>
            <p className="text-sm text-gray-500 mt-1">
              {loading ? '...' : `${filteredSprints.length} sprints`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border ${
                viewMode === 'list'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <List className="h-4 w-4" />
              List
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border ${
                viewMode === 'card'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
        {filterTabs.map((tab) => {
          const count = tab.key === 'all'
            ? sprints.length
            : sprints.filter((s) => s.status === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                statusFilter === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs text-gray-400">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Velocity Chart */}
      {velocityData.length > 0 && (
        <div className="mb-6">
          <VelocityChart data={velocityData} />
        </div>
      )}

      {/* Sprint List or Cards */}
      {viewMode === 'list' ? (
        <SprintList sprints={filteredSprints} loading={loading} />
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse"
            >
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
              <div className="h-2.5 bg-gray-100 rounded-full mb-4" />
              <div className="h-4 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filteredSprints.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">No sprints found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSprints.map((sprint) => (
            <Link key={sprint.id} href={`/dashboard/pm/sprints/${sprint.id}`}>
              <SprintCard sprint={sprint} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
