'use client';

/**
 * PM Settings Page - /dashboard/pm/settings
 *
 * Shows PM module settings including Custom Fields management per project.
 * Users select a project, then edit its custom field definitions.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, FolderKanban } from 'lucide-react';
import { listProjects, getProjectDetail } from '@/lib/pm-queries';
import { CustomFieldsEditor } from '../components/CustomFieldsEditor';
import type { PmProject, CustomFieldDefinition } from '@/lib/pm-types';

export default function SettingsPage() {
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<PmProject | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);

  // Load all projects
  useEffect(() => {
    async function load() {
      setLoadingProjects(true);
      try {
        const data = await listProjects();
        setProjects(data);
      } catch (err) {
        console.error('Failed to load projects:', err);
      } finally {
        setLoadingProjects(false);
      }
    }
    load();
  }, []);

  // Load selected project detail (to get custom_field_definitions)
  const loadSelectedProject = useCallback(async () => {
    if (!selectedProjectId) {
      setSelectedProject(null);
      return;
    }
    setLoadingProject(true);
    try {
      const data = await getProjectDetail(selectedProjectId);
      setSelectedProject(data.project);
    } catch (err) {
      console.error('Failed to load project detail:', err);
      setSelectedProject(null);
    } finally {
      setLoadingProject(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadSelectedProject();
  }, [loadSelectedProject]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard/pm"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure the PM module settings.
        </p>
      </div>

      {/* Custom Fields Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Custom Fields
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Define custom metadata fields per project. These fields appear on each backlog item
          in the selected project.
        </p>

        {/* Project selector */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Select Project
          </label>
          {loadingProjects ? (
            <div className="h-10 bg-gray-100 rounded-md animate-pulse" />
          ) : (
            <select
              value={selectedProjectId ?? ''}
              onChange={(e) => setSelectedProjectId(e.target.value || null)}
              className="w-full max-w-md text-sm text-gray-900 bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Custom fields editor for selected project */}
        {selectedProjectId && (
          <>
            {loadingProject ? (
              <div className="animate-pulse space-y-3">
                <div className="h-12 bg-gray-100 rounded-md" />
                <div className="h-32 bg-gray-100 rounded-md" />
              </div>
            ) : selectedProject ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FolderKanban className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-900">
                    {selectedProject.name}
                  </span>
                </div>
                <CustomFieldsEditor
                  projectId={selectedProject.id}
                  definitions={selectedProject.custom_field_definitions ?? []}
                  onUpdate={loadSelectedProject}
                />
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                Project not found.
              </div>
            )}
          </>
        )}

        {!selectedProjectId && !loadingProjects && (
          <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-sm text-gray-400">
              Select a project to manage its custom fields.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
