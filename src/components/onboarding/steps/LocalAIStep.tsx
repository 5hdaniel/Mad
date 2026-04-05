/**
 * LocalAIStep
 *
 * Optional onboarding step for setting up local AI (Gemma 4).
 * Shows system recommendations and allows model download.
 * Reuses GemmaModelSelector component (also used in Settings).
 *
 * @module onboarding/steps/LocalAIStep
 */

import React, { useState } from "react";
import type {
  OnboardingStep,
  OnboardingStepMeta,
  OnboardingStepContentProps,
} from "../types";
import { GemmaModelSelector } from "../../llm/GemmaModelSelector";

// =============================================================================
// CONTENT COMPONENT
// =============================================================================

function LocalAIStepContent({
  context,
  onAction,
}: OnboardingStepContentProps): React.ReactElement {
  const [modelReady, setModelReady] = useState(false);

  const handleModelReady = () => {
    setModelReady(true);
  };

  const handleSkip = () => {
    onAction({ type: "NAVIGATE_NEXT" });
  };

  const handleContinue = () => {
    onAction({ type: "NAVIGATE_NEXT" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">
          AI Assistant
        </h2>
        <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto">
          Power up Keepr with on-device AI. Get an AI chatbot, automatic transaction
          timelines, and smart analysis — all free and completely private.
        </p>
      </div>

      {/* Model Selector (reused component) */}
      <GemmaModelSelector
        userId={context.userId ?? ""}
        onModelReady={handleModelReady}
        onSkip={handleSkip}
      />

      {/* Continue button (shown after download) */}
      {modelReady && (
        <button
          onClick={handleContinue}
          className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          Continue
        </button>
      )}
    </div>
  );
}

// =============================================================================
// STEP META
// =============================================================================

const meta: OnboardingStepMeta = {
  id: "local-ai-setup",
  progressLabel: "AI Assistant",
  navigation: {
    showBack: true,
    hideContinue: true, // Custom continue button in content
  },
  skip: {
    enabled: true,
    label: "Skip for now",
    description: "You can set up AI features later in Settings",
  },
  isStepComplete: () => false, // User must interact
};

// =============================================================================
// STEP EXPORT
// =============================================================================

const LocalAIStep: OnboardingStep = {
  meta,
  Content: LocalAIStepContent,
};

export default LocalAIStep;
