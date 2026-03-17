'use client';

/**
 * ProjectList - PM Module
 *
 * Responsive grid of ProjectCard components with loading skeleton
 * and empty state handling. Receives data via props (no RPC calls).
 */

import type { PmProject } from '@/lib/pm-types';
import { ProjectCard } from './ProjectCard';

interface ProjectListProps {
  projects: PmProject[];
  loading?: boolean;
}

export function ProjectList({ projects, loading = false }: ProjectListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse"
          >
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 bg-gray-200 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-full" />
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <div className="h-3 bg-gray-200 rounded w-16" />
              <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full mt-3" />
          </div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-sm">No projects found</p>
        <p className="text-xs text-gray-400 mt-1">
          Create a project to organize your work
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
