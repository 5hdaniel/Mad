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

interface StepCircleProps {
  stepNumber: number;
  status: StepStatus;
}

interface ConnectingLineProps {
  completed: boolean;
}

interface StepLabelProps {
  label: string;
  isActive: boolean;
}

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
 * Renders a step circle with status-based styling.
 * - Completed: green background with checkmark
 * - Current: blue background with ring highlight
 * - Pending: gray background with number
 */
function StepCircle({ stepNumber, status }: StepCircleProps) {
  const baseClasses =
    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all flex-shrink-0";

  const statusClasses: Record<StepStatus, string> = {
    completed: "bg-green-500 text-white",
    current: "bg-blue-500 text-white ring-2 ring-offset-2 ring-blue-500",
    pending: "bg-gray-200 text-gray-500",
  };

  return (
    <div className={`${baseClasses} ${statusClasses[status]}`}>
      {status === "completed" ? <CheckmarkIcon /> : stepNumber}
    </div>
  );
}

/**
 * Renders the connecting line between step circles.
 * - Completed: green line
 * - Pending: gray line
 */
function ConnectingLine({ completed }: ConnectingLineProps) {
  return (
    <div
      className={`flex-1 h-0.5 mx-1 transition-all max-w-[48px] ${
        completed ? "bg-green-500" : "bg-gray-200"
      }`}
    />
  );
}

/**
 * Renders the label below a step circle.
 * - Active: blue text with medium font weight
 * - Inactive: gray text
 */
function StepLabel({ label, isActive }: StepLabelProps) {
  return (
    <div className="flex-shrink-0 w-8 flex items-center justify-center">
      <span
        className={`text-xs text-center max-w-[56px] ${
          isActive ? "text-blue-600 font-medium" : "text-gray-500"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Invisible spacer to maintain alignment between labels.
 * Matches the width of the connecting lines.
 */
function LabelSpacer() {
  return <div className="flex-1 mx-1 max-w-[48px]" />;
}

/**
 * Small invisible spacer at the edges of the indicator.
 */
function EdgeSpacer() {
  return <div className="w-1 h-0.5 flex-shrink-0" />;
}

/**
 * Small invisible spacer for labels at the edges.
 */
function LabelEdgeSpacer() {
  return <div className="w-1 flex-shrink-0" />;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Progress indicator showing onboarding step progression.
 * Reads labels from step metadata - single source of truth.
 *
 * Visual design matches the existing SetupProgressIndicator component.
 *
 * @example
 * <ProgressIndicator
 *   steps={flowSteps}
 *   currentIndex={2}
 *   viewingIndex={1} // User navigated back
 * />
 */
export function ProgressIndicator({
  steps,
  currentIndex,
  viewingIndex,
}: ProgressIndicatorProps) {
  // Handle edge cases
  if (steps.length === 0) {
    return null;
  }

  const activeIndex = viewingIndex ?? currentIndex;

  return (
    <div className="mb-8">
      {/* Circles and connecting lines */}
      <div className="flex items-center justify-center px-2 mb-3">
        {/* Invisible spacer before first circle */}
        <EdgeSpacer />

        {steps.map((step, index) => (
          <React.Fragment key={step.meta.id}>
            <StepCircle
              stepNumber={index + 1}
              status={getStepStatus(index, currentIndex, activeIndex)}
            />
            {index < steps.length - 1 && (
              <ConnectingLine completed={index < currentIndex} />
            )}
          </React.Fragment>
        ))}

        {/* Invisible spacer after last circle */}
        <EdgeSpacer />
      </div>

      {/* Labels - aligned with circles above */}
      <div className="flex items-start justify-center px-2">
        {/* Invisible spacer to match circle row */}
        <LabelEdgeSpacer />

        {steps.map((step, index) => (
          <React.Fragment key={`label-${step.meta.id}`}>
            <StepLabel
              label={step.meta.progressLabel}
              isActive={index === activeIndex}
            />
            {index < steps.length - 1 && <LabelSpacer />}
          </React.Fragment>
        ))}

        {/* Invisible spacer to match circle row */}
        <LabelEdgeSpacer />
      </div>
    </div>
  );
}

export default ProgressIndicator;
