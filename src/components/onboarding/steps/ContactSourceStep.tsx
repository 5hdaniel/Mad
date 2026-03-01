/**
 * Contact Source Selection Step
 *
 * Prompts users to select which contact sources to sync during onboarding.
 * Shows platform-appropriate options:
 * - macOS: macOS Contacts App + Outlook / Microsoft 365
 * - Windows: Outlook / Microsoft 365 only
 *
 * Selected sources are saved to Supabase as contactSources.direct preferences.
 * Skipping defaults to all available sources enabled (fail-open).
 *
 * @module onboarding/steps/ContactSourceStep
 */

import React, { useState, useCallback, useMemo } from "react";
import type {
  OnboardingStep,
  OnboardingStepMeta,
  OnboardingStepContentProps,
} from "../types";
import { usePlatform } from "../../../contexts/PlatformContext";
import logger from "../../../utils/logger";

// =============================================================================
// SOURCE CONFIGURATION
// =============================================================================

interface SourceConfig {
  key: "macosContacts" | "outlookContacts";
  label: string;
  description: string;
  icon: React.ReactNode;
  selectedBorder: string;
  selectedBg: string;
  /** Only show on these platforms. Undefined = all platforms. */
  platforms?: ("macos" | "windows")[];
}

const SOURCE_OPTIONS: SourceConfig[] = [
  {
    key: "macosContacts",
    label: "macOS Contacts App",
    description: "Sync contacts from the built-in macOS Contacts app",
    icon: (
      <svg
        className="w-7 h-7 text-violet-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
    selectedBorder: "border-violet-400",
    selectedBg: "bg-violet-50",
    platforms: ["macos"],
  },
  {
    key: "outlookContacts",
    label: "Outlook / Microsoft 365",
    description: "Sync contacts from your connected Microsoft account",
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 21 21" fill="none">
        <rect x="1" y="1" width="9" height="9" fill="#F25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
        <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
        <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
      </svg>
    ),
    selectedBorder: "border-blue-400",
    selectedBg: "bg-blue-50",
  },
];

// =============================================================================
// STEP META
// =============================================================================

export const meta: OnboardingStepMeta = {
  id: "contact-source",
  progressLabel: "Contacts",
  platforms: ["macos", "windows"],
  navigation: {
    showBack: true,
    hideContinue: true,
  },
  skip: {
    enabled: true,
    label: "I'll set this up later",
    description: "All available sources will be enabled by default",
  },
  // Step is complete once the user has proceeded (either by selecting sources or skipping)
  isStepComplete: () => false,
  canProceed: () => true,
  // Queue predicates
  isApplicable: () => true,
  isComplete: () => false, // User must interact
};

// =============================================================================
// CONTENT COMPONENT
// =============================================================================

/**
 * Renders a selectable card for a contact source.
 */
function SourceCard({
  source,
  isSelected,
  onToggle,
  isSaving,
}: {
  source: SourceConfig;
  isSelected: boolean;
  onToggle: () => void;
  isSaving: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isSaving}
      className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed ${
        isSelected
          ? `${source.selectedBorder} ${source.selectedBg} shadow-sm`
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isSelected ? "bg-white shadow-md" : "bg-gray-100"
        }`}
      >
        {source.icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-gray-900">{source.label}</h4>
        <p className="text-xs text-gray-500 mt-0.5">{source.description}</p>
      </div>
      <div className="flex-shrink-0">
        {isSelected ? (
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
        )}
      </div>
    </button>
  );
}

/**
 * Contact Source Selection Step Content Component
 *
 * Shows platform-appropriate contact source options as multi-select cards.
 * On macOS: shows both macOS Contacts and Outlook.
 * On Windows: shows Outlook only.
 */
export function Content({
  context,
  onAction,
}: OnboardingStepContentProps): React.ReactElement {
  const { isMacOS } = usePlatform();
  const [isSaving, setIsSaving] = useState(false);

  // Default both sources to selected (fail-open)
  const [selected, setSelected] = useState<Record<string, boolean>>({
    macosContacts: true,
    outlookContacts: true,
  });

  // Filter sources by current platform (memoized to avoid re-creation every render)
  const visibleSources = useMemo(
    () =>
      SOURCE_OPTIONS.filter((source) => {
        if (!source.platforms) return true;
        return source.platforms.includes(isMacOS ? "macos" : "windows");
      }),
    [isMacOS]
  );

  const handleToggle = useCallback((key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleContinue = useCallback(async () => {
    if (!context.userId) {
      // No user, just proceed
      onAction({ type: "NAVIGATE_NEXT" });
      return;
    }

    setIsSaving(true);
    try {
      // Build preferences object for visible sources only
      const directPrefs: Record<string, boolean> = {};
      for (const source of visibleSources) {
        directPrefs[source.key] = selected[source.key] ?? true;
      }

      await window.api.preferences.update(context.userId, {
        contactSources: {
          direct: directPrefs,
        },
      });

      logger.info(
        "[ContactSourceStep] Saved contact source preferences:",
        directPrefs
      );
    } catch (err) {
      // Non-fatal: preferences will default to enabled (fail-open)
      logger.warn(
        "[ContactSourceStep] Failed to save preferences, continuing with defaults:",
        err
      );
    } finally {
      setIsSaving(false);
    }

    onAction({ type: "NAVIGATE_NEXT" });
  }, [context.userId, visibleSources, selected, onAction]);

  return (
    <>
      {/* Header */}
      <div className="text-center mb-5">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-violet-500 to-blue-600 rounded-full mb-3 shadow-lg">
          <svg
            className="w-7 h-7 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Where do you save your contacts?
        </h2>
        <p className="text-sm text-gray-600">
          Select the contact sources you use. Keepr will import contacts from
          these sources to help identify parties in your transactions.
        </p>
      </div>

      {/* Info box */}
      <div className="mb-5 bg-blue-50 rounded-xl p-3">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          Why import contacts?
        </h3>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-sm text-blue-800">
            <svg
              className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>
              Automatically match contacts to transaction communications
            </span>
          </li>
          <li className="flex items-start gap-2 text-sm text-blue-800">
            <svg
              className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>
              Identify clients, agents, and other parties in your audits
            </span>
          </li>
        </ul>
      </div>

      {/* Source cards */}
      <div className="space-y-3 mb-5">
        {visibleSources.map((source) => (
          <SourceCard
            key={source.key}
            source={source}
            isSelected={selected[source.key] ?? true}
            onToggle={() => handleToggle(source.key)}
            isSaving={isSaving}
          />
        ))}
      </div>

      {/* Continue button */}
      <button
        onClick={handleContinue}
        disabled={isSaving}
        className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
      >
        {isSaving ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Saving...</span>
          </>
        ) : (
          <span>Continue</span>
        )}
      </button>

      {/* Note about settings */}
      <p className="text-center text-xs text-gray-500 mt-3">
        You can change these settings anytime in Settings &gt; Contacts.
      </p>

      {/* Skip button is managed by shell via meta.skip */}
    </>
  );
}

// =============================================================================
// STEP REGISTRATION
// =============================================================================

const ContactSourceStep: OnboardingStep = {
  meta,
  Content,
};

export default ContactSourceStep;
