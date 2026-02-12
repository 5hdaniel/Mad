/**
 * ImportSourceSettings Component
 *
 * Allows macOS users to choose between importing from:
 * - macOS Messages database + Contacts app (native)
 * - Connected iPhone via iTunes backup (sync)
 *
 * Only visible on macOS platform.
 *
 * @module settings/ImportSourceSettings
 */

import React, { useState, useEffect, useCallback } from "react";
import { usePlatform } from "../../contexts/PlatformContext";
import type { ImportSource, UserPreferences } from "../../services/settingsService";

// Re-export type for consumers
export type { ImportSource } from "../../services/settingsService";

interface ImportSourceSettingsProps {
  userId: string;
}

/**
 * Import source settings for macOS users.
 * Allows switching between macOS native import and iPhone sync.
 */
export function ImportSourceSettings({ userId }: ImportSourceSettingsProps) {
  const { isMacOS } = usePlatform();
  const [source, setSource] = useState<ImportSource>("macos-native");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load preference on mount
  useEffect(() => {
    if (!isMacOS || !userId) return;

    const loadPreference = async () => {
      setLoading(true);
      try {
        const result = await window.api.preferences.get(userId);
        const prefs = result.preferences as UserPreferences | undefined;
        if (result.success && prefs?.messages?.source) {
          setSource(prefs.messages.source);
        }
      } catch (error) {
        console.error("[ImportSourceSettings] Failed to load preference:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPreference();
  }, [userId, isMacOS]);

  const handleSourceChange = useCallback(
    async (newSource: ImportSource) => {
      if (!userId || saving) return;

      setSource(newSource);
      setSaving(true);

      try {
        await window.api.preferences.update(userId, {
          messages: {
            source: newSource,
          },
        });
      } catch (error) {
        console.error("[ImportSourceSettings] Failed to save preference:", error);
        // Revert on error
        setSource(source);
      } finally {
        setSaving(false);
      }
    },
    [userId, source, saving]
  );

  // Only render on macOS
  if (!isMacOS) {
    return null;
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <h4 className="text-sm font-medium text-gray-900 mb-2">Import Source</h4>
      <p className="text-xs text-gray-600 mb-3">
        Choose where to import your messages and contacts from.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {/* Radio: macOS Messages + Contacts */}
            <label
              className={`flex items-start gap-3 p-3 bg-white rounded border cursor-pointer transition-all ${
                source === "macos-native"
                  ? "border-blue-500 ring-1 ring-blue-500"
                  : "border-gray-200 hover:border-gray-300"
              } ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input
                type="radio"
                name="importSource"
                value="macos-native"
                checked={source === "macos-native"}
                onChange={() => handleSourceChange("macos-native")}
                disabled={saving}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  macOS Messages + Contacts
                </div>
                <div className="text-xs text-gray-500">
                  Import from your Mac's Messages app and Contacts
                </div>
              </div>
            </label>

            {/* Radio: iPhone Sync */}
            <label
              className={`flex items-start gap-3 p-3 bg-white rounded border cursor-pointer transition-all ${
                source === "iphone-sync"
                  ? "border-blue-500 ring-1 ring-blue-500"
                  : "border-gray-200 hover:border-gray-300"
              } ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input
                type="radio"
                name="importSource"
                value="iphone-sync"
                checked={source === "iphone-sync"}
                onChange={() => handleSourceChange("iphone-sync")}
                disabled={saving}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  iPhone Sync
                </div>
                <div className="text-xs text-gray-500">
                  Sync from a connected iPhone (same as Windows experience)
                </div>
              </div>
            </label>
          </div>

          {/* Show iPhone instructions when that source is selected */}
          {source === "iphone-sync" && (
            <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-700">
              <p className="font-medium mb-1">To use iPhone Sync:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Connect your iPhone to this Mac via USB</li>
                <li>Trust this computer on your iPhone if prompted</li>
                <li>Click "Import from iPhone" to sync messages</li>
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ImportSourceSettings;
