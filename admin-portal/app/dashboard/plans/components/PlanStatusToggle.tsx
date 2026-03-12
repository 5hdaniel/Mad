'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { togglePlanActive } from '@/lib/admin-queries';

interface PlanStatusToggleProps {
  planId: string;
  isActive: boolean;
  canManage: boolean;
}

export function PlanStatusToggle({ planId, isActive, canManage }: PlanStatusToggleProps) {
  const [active, setActive] = useState(isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleToggle = async () => {
    if (!canManage) return;

    setSaving(true);
    setError(null);
    const result = await togglePlanActive(planId, !active);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setActive(!active);
    router.refresh();
    setSaving(false);
  };

  return (
    <div className="inline-flex flex-col items-start">
      <button
        onClick={handleToggle}
        disabled={!canManage || saving}
        title={canManage ? (active ? 'Click to deactivate' : 'Click to activate') : undefined}
        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
          canManage ? 'cursor-pointer hover:opacity-80' : ''
        } ${
          active
            ? 'text-green-700 bg-green-100'
            : 'text-gray-500 bg-gray-100'
        } ${saving ? 'opacity-50' : ''}`}
      >
        {active ? (
          <>
            <CheckCircle2 className="h-3 w-3" />
            {saving ? 'Saving...' : 'Active'}
          </>
        ) : (
          <>
            <XCircle className="h-3 w-3" />
            {saving ? 'Saving...' : 'Inactive'}
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}
