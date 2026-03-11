/**
 * useFeatureGate Hook
 * SPRINT-122: Plan Admin + Feature Gate Enforcement
 *
 * Provides feature access checks in the renderer process.
 * Loads all features on mount and provides an isAllowed() helper.
 *
 * Design:
 * - Fetches all features once on mount
 * - Defaults to allowed for unknown features (fail-open)
 * - Loading state prevents blocking UI
 *
 * @example
 * ```tsx
 * const { isAllowed, loading } = useFeatureGate();
 *
 * if (!loading && !isAllowed("text_export")) {
 *   return <UpgradePrompt featureName="Text Export" />;
 * }
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { FeatureAccess } from "../../electron/types/featureGate";

export type { FeatureAccess } from "../../electron/types/featureGate";

interface UseFeatureGateReturn {
  /** Check if a feature is allowed. Returns true for unknown features (fail-open). */
  isAllowed: (featureKey: string) => boolean;
  /** All loaded features */
  features: Record<string, FeatureAccess>;
  /** True while features are being loaded */
  loading: boolean;
  /** Refresh features from the server */
  refresh: () => Promise<void>;
}

export function useFeatureGate(): UseFeatureGateReturn {
  const [features, setFeatures] = useState<Record<string, FeatureAccess>>({});
  const [loading, setLoading] = useState(true);

  const loadFeatures = useCallback(async () => {
    try {
      const result = await window.api.featureGate.getAll();
      setFeatures(result);
    } catch {
      // On error, keep empty features (fail-open: everything allowed)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await window.api.featureGate.invalidateCache();
    await loadFeatures();
  }, [loadFeatures]);

  const isAllowed = useCallback(
    (featureKey: string): boolean => {
      const feature = features[featureKey];
      // Default to allowed if feature is unknown (fail-open)
      return feature?.allowed ?? true;
    },
    [features]
  );

  return useMemo(
    () => ({
      isAllowed,
      features,
      loading,
      refresh,
    }),
    [isAllowed, features, loading, refresh]
  );
}

export default useFeatureGate;
