'use client';

/**
 * FeatureToggleList - Interactive feature toggle grid for a plan.
 *
 * Groups features by category and renders:
 * - Boolean features: toggle switch
 * - Integer features: number input
 * - String features: text input
 *
 * Tracks dirty state and provides a save button with confirmation.
 */

import { useState, useMemo, useCallback } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { updatePlanFeature, type FeatureDefinition, type PlanFeature } from '@/lib/admin-queries';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';

interface FeatureState {
  enabled: boolean;
  value: string | null;
}

interface FeatureToggleListProps {
  planId: string;
  features: PlanFeature[];
  allFeatures: FeatureDefinition[];
  canManage: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  export: 'Export',
  sync: 'Sync',
  compliance: 'Compliance',
  general: 'General',
};

const CATEGORY_ORDER = ['general', 'sync', 'export', 'compliance'];

function computeInitialState(
  features: PlanFeature[],
  allFeatures: FeatureDefinition[],
): Record<string, FeatureState> {
  const state: Record<string, FeatureState> = {};
  for (const fd of allFeatures) {
    const pf = features.find((f) => f.feature_id === fd.id);
    state[fd.id] = {
      enabled: pf?.enabled ?? false,
      value: pf?.value ?? fd.default_value ?? null,
    };
  }
  return state;
}

export function FeatureToggleList({ planId, features, allFeatures, canManage }: FeatureToggleListProps) {
  // Build initial state map: featureId -> { enabled, value }
  // Stored in state so it can be updated after a successful save,
  // allowing isDirty to return false and "Changes saved" to appear.
  const [initialState, setInitialState] = useState<Record<string, FeatureState>>(() =>
    computeInitialState(features, allFeatures),
  );

  const [featureState, setFeatureState] = useState<Record<string, FeatureState>>(() =>
    computeInitialState(features, allFeatures),
  );
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Group features by category
  const grouped = useMemo(() => {
    const groups: Record<string, FeatureDefinition[]> = {};
    for (const fd of allFeatures) {
      const cat = fd.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(fd);
    }
    return groups;
  }, [allFeatures]);

  // Sorted category keys
  const sortedCategories = useMemo(() => {
    const keys = Object.keys(grouped);
    return keys.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [grouped]);

  // Check if any changes have been made
  const isDirty = useMemo(() => {
    for (const fdId of Object.keys(featureState)) {
      const current = featureState[fdId];
      const initial = initialState[fdId];
      if (!initial) continue;
      if (current.enabled !== initial.enabled || current.value !== initial.value) {
        return true;
      }
    }
    return false;
  }, [featureState, initialState]);

  const handleToggle = useCallback((featureId: string) => {
    setFeatureState((prev) => ({
      ...prev,
      [featureId]: { ...prev[featureId], enabled: !prev[featureId].enabled },
    }));
    setSaveSuccess(false);
  }, []);

  const handleToggleCategory = useCallback((categoryFeatures: FeatureDefinition[]) => {
    setFeatureState((prev) => {
      const allEnabled = categoryFeatures.every((fd) => prev[fd.id]?.enabled);
      const updated = { ...prev };
      for (const fd of categoryFeatures) {
        updated[fd.id] = { ...updated[fd.id], enabled: !allEnabled };
      }
      return updated;
    });
    setSaveSuccess(false);
  }, []);

  const handleValueChange = useCallback((featureId: string, value: string) => {
    setFeatureState((prev) => ({
      ...prev,
      [featureId]: { ...prev[featureId], value },
    }));
    setSaveSuccess(false);
  }, []);

  const handleReset = useCallback(() => {
    setFeatureState(initialState);
    setSaveError(null);
    setSaveSuccess(false);
  }, [initialState]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setShowConfirm(false);

    // Find changed features and save them
    const changes: { featureId: string; enabled: boolean; value: string | null }[] = [];
    for (const fdId of Object.keys(featureState)) {
      const current = featureState[fdId];
      const initial = initialState[fdId];
      if (!initial) continue;
      if (current.enabled !== initial.enabled || current.value !== initial.value) {
        changes.push({ featureId: fdId, enabled: current.enabled, value: current.value });
      }
    }

    for (const change of changes) {
      const result = await updatePlanFeature(planId, change.featureId, change.enabled, change.value);
      if (result.error) {
        setSaveError(`Failed to update feature: ${result.error.message}`);
        setSaving(false);
        return;
      }
    }

    // Update baseline so isDirty returns false and "Changes saved" becomes visible
    setInitialState({ ...featureState });
    setSaving(false);
    setSaveSuccess(true);
  };

  return (
    <div className="space-y-6">
      {/* Save bar */}
      {canManage && (
        <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3">
            {isDirty && (
              <span className="text-sm text-amber-600 font-medium">Unsaved changes</span>
            )}
            {saveSuccess && !isDirty && (
              <span className="text-sm text-green-600 font-medium">Changes saved</span>
            )}
            {saveError && (
              <span className="text-sm text-red-600">{saveError}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <button
                onClick={handleReset}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            )}
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!isDirty || saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Feature groups */}
      {sortedCategories.map((category) => (
        <div key={category} className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              {CATEGORY_LABELS[category] ?? category}
            </h3>
            {canManage && (
              <button
                onClick={() => handleToggleCategory(grouped[category])}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                {grouped[category].every((fd) => featureState[fd.id]?.enabled) ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {grouped[category].map((fd) => {
              const state = featureState[fd.id];
              if (!state) return null;

              return (
                <div key={fd.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{fd.name}</p>
                    {fd.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{fd.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{fd.key}</p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {/* Value input for non-boolean types */}
                    {fd.value_type === 'integer' && (
                      <input
                        type="number"
                        value={state.value ?? ''}
                        onChange={(e) => handleValueChange(fd.id, e.target.value)}
                        disabled={!canManage || !state.enabled}
                        className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50 disabled:bg-gray-50"
                      />
                    )}
                    {fd.value_type === 'string' && (
                      <input
                        type="text"
                        value={state.value ?? ''}
                        onChange={(e) => handleValueChange(fd.id, e.target.value)}
                        disabled={!canManage || !state.enabled}
                        className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50 disabled:bg-gray-50"
                      />
                    )}

                    {/* Toggle switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={state.enabled}
                      onClick={() => handleToggle(fd.id)}
                      disabled={!canManage}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                        state.enabled ? 'bg-primary-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          state.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {allFeatures.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">No features defined yet.</p>
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (
        <ConfirmationDialog
          title="Save Feature Changes"
          description="Are you sure you want to save these feature configuration changes? This will immediately affect organizations on this plan."
          confirmLabel="Save Changes"
          onConfirm={handleSave}
          onCancel={() => setShowConfirm(false)}
          isLoading={saving}
        />
      )}
    </div>
  );
}
