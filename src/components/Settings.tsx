import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { LLMSettings } from "./settings/LLMSettings";
import { MacOSMessagesImportSettings } from "./settings/MacOSMessagesImportSettings";
import { ImportSourceSettings } from "./settings/ImportSourceSettings";
import { FeatureGate } from "./common/FeatureGate";
import { SettingsTabBar } from "./settings/SettingsTabBar";
import { GeneralSettings } from "./settings/GeneralSettings";
import { EmailSettings } from "./settings/EmailSettings";
import { ContactsSettings } from "./settings/ContactsSettings";
import { SecuritySettings } from "./settings/SecuritySettings";
import { DataPrivacySettings } from "./settings/DataPrivacySettings";
import { AboutSettings } from "./settings/AboutSettings";
import { SyncToolsSettings } from "./settings/SyncToolsSettings";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { useFeatureGate } from "@/hooks/useFeatureGate";
import { OfflineNotice } from './common/OfflineNotice';
import { settingsService } from '../services';
import logger from '../utils/logger';
import type { PreferencesResult } from './settings/types';

const SETTINGS_TABS = [
  { id: "settings-general", label: "General" },
  { id: "settings-email", label: "Email" },
  { id: "settings-messages", label: "Messages" },
  { id: "settings-contacts", label: "Contacts" },
  { id: "settings-ai", label: "AI" },
  { id: "settings-security", label: "Security" },
  { id: "settings-sync", label: "Sync" },
  { id: "settings-data", label: "Data & Privacy" },
  { id: "settings-about", label: "About" },
];

/** Detect Windows platform via IPC bridge */
const isWindows = window.api?.system?.platform === "win32";

interface SettingsComponentProps {
  onClose: () => void;
  userId: string;
  onLogout?: () => Promise<void>;
  onEmailConnected?: (email: string, provider: "google" | "microsoft") => void;
  onEmailDisconnected?: (provider: "google" | "microsoft") => void;
}

/** Settings — tab container that delegates to focused sub-components. */
function Settings({ onClose, userId, onLogout, onEmailConnected, onEmailDisconnected }: SettingsComponentProps) {
  const { isAllowed } = useFeatureGate();
  const hasAIAddon = isAllowed("ai_detection");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const visibleTabs = useMemo(
    () =>
      SETTINGS_TABS.filter((t) => {
        if (t.id === "settings-ai" && !hasAIAddon) return false;
        if (t.id === "settings-sync" && !isWindows) return false;
        return true;
      }),
    [hasAIAddon]
  );
  const visibleTabIds = useMemo(() => visibleTabs.map((t) => t.id), [visibleTabs]);

  // Preferences loaded once and distributed to sub-components as initial values
  const [loadingPreferences, setLoadingPreferences] = useState<boolean>(true);
  const [preferences, setPreferences] = useState<PreferencesResult['preferences']>(undefined);

  // Connection status reported by EmailSettings, needed by ContactsSettings
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(false);
  const [isMicrosoftConnected, setIsMicrosoftConnected] = useState<boolean>(false);

  const activeTabId = useScrollSpy(visibleTabIds, scrollContainerRef, 48, !loadingPreferences);

  const handleTabClick = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleConnectionStatusChange = useCallback((google: boolean, microsoft: boolean) => {
    setIsGoogleConnected(google);
    setIsMicrosoftConnected(microsoft);
  }, []);

  // Load all preferences once on mount
  useEffect(() => {
    const loadPreferences = async (): Promise<void> => {
      setLoadingPreferences(true);
      try {
        const result = await settingsService.getPreferences(userId);
        const prefs = result.data as PreferencesResult['preferences'];
        if (result.success && prefs) {
          setPreferences(prefs);
        } else if (!result.success) {
          logger.error("[Settings] Failed to load preferences:", result.error);
        }
      } catch (error) {
        logger.error("[Settings] Error loading preferences:", error);
      } finally {
        setLoadingPreferences(false);
      }
    };
    if (userId) {
      loadPreferences();
    }
  }, [userId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Settings Content - Scrollable area */}
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto scroll-smooth scroll-pt-12 px-6 pb-6">
          {loadingPreferences ? (
            <div className="flex flex-col items-center justify-center pt-24 pb-20">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-500">Loading settings...</p>
            </div>
          ) : (
          <>
            <SettingsTabBar tabs={visibleTabs} activeTabId={activeTabId} onTabClick={handleTabClick} />
            <div className="sticky top-10 z-10 -mx-6 bg-white">
              <OfflineNotice />
            </div>

            <GeneralSettings userId={userId} initialPreferences={preferences} />

            <EmailSettings
              userId={userId}
              initialPreferences={preferences}
              onEmailConnected={onEmailConnected}
              onEmailDisconnected={onEmailDisconnected}
              onConnectionStatusChange={handleConnectionStatusChange}
            />

            {/* macOS Messages Import */}
            <div id="settings-messages" className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Messages</h3>
              <div className="space-y-4">
                <ImportSourceSettings userId={userId} />
                <MacOSMessagesImportSettings userId={userId} />
              </div>
            </div>

            <ContactsSettings
              userId={userId}
              initialPreferences={preferences}
              isMicrosoftConnected={isMicrosoftConnected}
              isGoogleConnected={isGoogleConnected}
            />

            {/* AI Settings - Only visible with AI add-on (BACKLOG-462) */}
            <FeatureGate requires="ai_addon">
              <div id="settings-ai" className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">Transaction Detection</h4>
                      <p className="text-xs text-gray-600 mt-1">
                        Scans your email for new transactions since your last scan. First scan covers 1 month.
                      </p>
                    </div>
                    <span className="ml-4 text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1.5 rounded border border-gray-200">
                      Automatic
                    </span>
                  </div>
                  <LLMSettings userId={userId} />
                </div>
              </div>
            </FeatureGate>

            <SecuritySettings userId={userId} onLogout={onLogout} />

            {/* Sync Tools — Windows only (TASK-2277) */}
            {isWindows && <SyncToolsSettings />}

            <DataPrivacySettings userId={userId} />
            <AboutSettings />
          </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-xl">
          <button
            onClick={onClose}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
