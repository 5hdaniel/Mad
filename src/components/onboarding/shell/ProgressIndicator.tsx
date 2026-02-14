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
// CONSTANTS
// =============================================================================

/** Circle diameter in pixels - single source of truth */
const CIRCLE_SIZE = 32; // w-8 h-8 = 32px
/** Gap between circle edge and line */
const LINE_GAP = 4;

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
// LEAF COMPONENTS (smallest, innermost)
// =============================================================================

/**
 * Checkmark SVG icon for completed steps.
 */
function CheckmarkIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

/**
 * The colored circle indicator.
 * - Completed: green with checkmark
 * - Current: blue with ring
 * - Pending: gray empty circle
 */
function StepCircle({
  status,
}: {
  status: StepStatus;
}) {
  const baseClasses =
    "flex items-center justify-center rounded-full text-sm font-semibold transition-all duration-200";

  const statusStyles: Record<StepStatus, string> = {
    completed: "bg-green-500 text-white",
    current: "bg-blue-500 text-white ring-4 ring-blue-200",
    pending: "bg-gray-200 text-gray-500",
  };

  return (
    <div
      className={`${baseClasses} ${statusStyles[status]}`}
      style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
      aria-current={status === "current" ? "step" : undefined}
    >
      {status === "completed" ? <CheckmarkIcon /> : null}
    </div>
  );
}

/**
 * Text label displayed below the circle.
 * Always single line, centered horizontally.
 */
function StepLabel({
  text,
  status,
}: {
  text: string;
  status: StepStatus;
}) {
  const statusStyles: Record<StepStatus, string> = {
    completed: "text-green-600",
    current: "text-blue-600 font-medium",
    pending: "text-gray-400",
  };

  return (
    <span
      className={`text-xs whitespace-nowrap text-center ${statusStyles[status]}`}
    >
      {text}
    </span>
  );
}

// =============================================================================
// COMPOSITE COMPONENTS
// =============================================================================

/**
 * Single step: circle + label stacked vertically.
 * The circle and label are always centered relative to each other.
 */
function Step({
  status,
  label,
}: {
  status: StepStatus;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <StepCircle status={status} />
      <StepLabel text={label} status={status} />
    </div>
  );
}

/**
 * Horizontal line connecting two step circles.
 * - Uses flex-grow to fill available space
 * - Gaps are created by parent padding, ensuring equal spacing
 */
function ConnectingLine({ completed }: { completed: boolean }) {
  return (
    <div
      className="flex-1 self-start transition-colors duration-200"
      style={{
        height: 2,
        marginTop: CIRCLE_SIZE / 2 - 1, // Center line with circle
        marginLeft: LINE_GAP,
        marginRight: LINE_GAP,
        minWidth: 24, // Minimum line width
        backgroundColor: completed ? "#22c55e" : "#e5e7eb", // green-500 : gray-200
      }}
      aria-hidden="true"
    />
  );
}

// =============================================================================
// MAIN COMPONENT (root container)
// =============================================================================

/**
 * Progress indicator showing onboarding step progression.
 *
 * Architecture (leaf to root):
 * 1. CheckmarkIcon - SVG icon
 * 2. StepCircle - colored circle with checkmark (completed) or empty
 * 3. StepLabel - text below circle
 * 4. Step - circle + label combined
 * 5. ConnectingLine - line between steps
 * 6. ProgressIndicator - centered container with all steps
 *
 * CSS Strategy:
 * - Outer container centers the progress bar horizontally
 * - Inner flex container uses items-start to align circles at top
 * - Lines use flex-grow to fill space, with equal margins for gaps
 * - Line vertical position calculated from circle size constant
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
    // Outer container: centers the progress bar
    <div className="w-full flex justify-center px-4">
      {/* Inner container: holds steps and lines in a row */}
      <div className="flex items-start">
        {steps.map((step, index) => (
          <React.Fragment key={step.meta.id}>
            <Step
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
