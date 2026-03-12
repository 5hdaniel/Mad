'use client';

/**
 * PlanTierEditor - Inline tier display with edit capability.
 *
 * When canManage is true, shows a dropdown to change the plan tier.
 * Calls admin_update_plan_tier RPC, which may reject with a list
 * of conflicting features if the tier is being downgraded.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updatePlanTier } from '@/lib/admin-queries';

const TIER_OPTIONS = ['individual', 'team', 'enterprise', 'custom'] as const;

const TIER_LABELS: Record<string, string> = {
  individual: 'Individual',
  team: 'Team',
  enterprise: 'Enterprise',
  custom: 'Custom',
};

interface PlanTierEditorProps {
  planId: string;
  currentTier: string;
  canManage: boolean;
}

export function PlanTierEditor({ planId, currentTier, canManage }: PlanTierEditorProps) {
  const [tier, setTier] = useState(currentTier);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!canManage) {
    return <span className="text-sm text-gray-900 capitalize">{TIER_LABELS[tier] ?? tier}</span>;
  }

  const handleChange = async (newTier: string) => {
    if (newTier === tier) return;

    setSaving(true);
    setError(null);

    const result = await updatePlanTier(planId, newTier);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setTier(newTier);
    setSaving(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-1">
      <select
        value={tier}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
      >
        {TIER_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {TIER_LABELS[t]}
          </option>
        ))}
      </select>
      {saving && <span className="text-xs text-gray-500">Saving...</span>}
      {error && (
        <p className="text-xs text-red-600 max-w-xs">{error}</p>
      )}
    </div>
  );
}
