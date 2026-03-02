import React, { useEffect, useRef, useState } from "react";
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

/** Circle diameter in pixels */
const CIRCLE_SIZE = 32;
/** Fixed width for each step column */
const STEP_WIDTH = 72;
/** Fixed width for connecting lines between steps */
const LINE_WIDTH = 28;
/** Distance from one step center to the next */
const STEP_SPACING = STEP_WIDTH + LINE_WIDTH;

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
// LEAF COMPONENTS
// =============================================================================

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

function StepCircle({ status }: { status: StepStatus }) {
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

function StepLabel({ text, status }: { text: string; status: StepStatus }) {
  const statusStyles: Record<StepStatus, string> = {
    completed: "text-green-600",
    current: "text-blue-600 font-medium",
    pending: "text-gray-400",
  };

  return (
    <span
      className={`text-xs text-center leading-tight w-full ${statusStyles[status]}`}
    >
      {text}
    </span>
  );
}

function ConnectingLine({ completed }: { completed: boolean }) {
  return (
    <div
      className="flex-shrink-0 self-start transition-colors duration-200"
      style={{
        height: 2,
        width: LINE_WIDTH,
        marginTop: CIRCLE_SIZE / 2 - 1,
        backgroundColor: completed ? "#22c55e" : "#e5e7eb",
      }}
      aria-hidden="true"
    />
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Progress indicator with centered active step.
 *
 * The active (blue) step is always centered horizontally. Completed steps
 * (green with checkmark) slide to the left, pending steps (gray) to the right.
 * On narrow screens, off-screen steps are clipped and the bar slides smoothly
 * as the user progresses.
 */
export function ProgressIndicator({
  steps,
  currentIndex,
  viewingIndex,
}: ProgressIndicatorProps) {
  if (steps.length === 0) return null;

  const activeIndex = viewingIndex ?? currentIndex;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Center of the active step relative to the bar's left edge
  const activeCenter = activeIndex * STEP_SPACING + STEP_WIDTH / 2;

  // Translate so the active step's center aligns with the container's center.
  // No clamping — the active step is always centered, edges clip naturally.
  const translateX = containerWidth > 0
    ? containerWidth / 2 - activeCenter
    : 0;

  return (
    <div ref={containerRef} className="w-full overflow-hidden px-4 pt-1">
      <div
        className="flex items-start"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: "transform 300ms ease-in-out",
        }}
      >
        {steps.map((step, index) => {
          const status = getStepStatus(index, currentIndex, activeIndex);
          return (
            <React.Fragment key={step.meta.id}>
              <div
                className="flex flex-col items-center gap-2 flex-shrink-0"
                style={{ width: STEP_WIDTH }}
              >
                <StepCircle status={status} />
                <StepLabel text={step.meta.progressLabel} status={status} />
              </div>
              {index < steps.length - 1 && (
                <ConnectingLine completed={index < currentIndex} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default ProgressIndicator;
