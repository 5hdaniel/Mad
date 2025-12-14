import React from "react";
import type { OnboardingStep } from "../types";

// =============================================================================
// TYPES
// =============================================================================

interface ProgressIndicatorProps {
  /** Ordered list of steps from the flow */
  steps: OnboardingStep[];
  /** Current step index (0-based) */
  currentIndex: number;
  /** Optional: which step user is viewing (for back navigation) */
  viewingIndex?: number;
}

type StepStatus = "completed" | "current" | "pending";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getStepStatus(
  index: number,
  currentIndex: number,
  activeIndex: number
): StepStatus {
  if (index < currentIndex) return "completed";
  if (index === activeIndex) return "current";
  return "pending";
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Renders the checkmark SVG for completed steps.
 */
function CheckmarkIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

/**
 * Single step item with circle and label stacked vertically.
 * Ensures perfect alignment between circle and its label.
 */
function StepItem({
  stepNumber,
  status,
  label,
}: {
  stepNumber: number;
  status: StepStatus;
  label: string;
}) {
  const circleClasses = "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all";

  const statusClasses: Record<StepStatus, string> = {
    completed: "bg-green-500 text-white",
    current: "bg-blue-500 text-white ring-2 ring-offset-2 ring-blue-500",
    pending: "bg-gray-200 text-gray-500",
  };

  const labelClasses = status === "current"
    ? "text-blue-600 font-medium"
    : "text-gray-500";

  return (
    <div className="flex flex-col items-center">
      {/* Circle */}
      <div className={`${circleClasses} ${statusClasses[status]}`}>
        {status === "completed" ? <CheckmarkIcon /> : stepNumber}
      </div>
      {/* Label */}
      <span className={`text-xs mt-2 whitespace-nowrap ${labelClasses}`}>
        {label}
      </span>
    </div>
  );
}

/**
 * Renders the connecting line between step circles.
 */
function ConnectingLine({ completed }: { completed: boolean }) {
  return (
    <div
      className={`w-16 h-0.5 mx-2 transition-all self-start mt-4 ${
        completed ? "bg-green-500" : "bg-gray-200"
      }`}
    />
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Progress indicator showing onboarding step progression.
 * Each step is a unified component with circle + label for perfect alignment.
 */
export function ProgressIndicator({
  steps,
  currentIndex,
  viewingIndex,
}: ProgressIndicatorProps) {
  if (steps.length === 0) {
    return null;
  }

  const activeIndex = viewingIndex ?? currentIndex;

  return (
    <div>
      <div className="flex items-start justify-center">
        {steps.map((step, index) => (
          <React.Fragment key={step.meta.id}>
            <StepItem
              stepNumber={index + 1}
              status={getStepStatus(index, currentIndex, activeIndex)}
              label={step.meta.progressLabel}
            />
            {index < steps.length - 1 && (
              <ConnectingLine completed={index < currentIndex} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default ProgressIndicator;
