/**
 * SyncProgress Component Types
 * Reusable progress component for sync/progress operations across the app.
 */

/**
 * Status of a progress step in the detailed variant
 */
export type SyncProgressStepStatus = 'pending' | 'active' | 'complete' | 'error';

/**
 * Individual step in the progress checklist (detailed variant)
 */
export interface SyncProgressStep {
  /** Display label for the step */
  label: string;
  /** Current status of the step */
  status: SyncProgressStepStatus;
  /** Optional duration display (e.g., "45s", "3m 22s") */
  duration?: string;
  /** Error message for failed steps */
  error?: string;
}

/**
 * Variant determines the visual layout of the progress component
 * - compact: Single-line with progress bar (for inline/card use)
 * - standard: Multi-line with title, progress bar, subtitle (for modals/panels)
 * - detailed: Full progress with expandable step-by-step checklist
 */
export type SyncProgressVariant = 'compact' | 'standard' | 'detailed';

/**
 * Props for the SyncProgress component
 */
export interface SyncProgressProps {
  // === Required ===
  /** Visual variant/layout of the component */
  variant: SyncProgressVariant;

  // === Progress ===
  /** Progress percentage (0-100). Undefined = indeterminate/spinner */
  progress?: number;
  /** Custom progress text (e.g., "6.2 GB / 8.0 GB") */
  progressText?: string;

  // === Display ===
  /** Main title text */
  title?: string;
  /** Secondary subtitle text */
  subtitle?: string;

  // === Steps (detailed variant) ===
  /** Array of steps for the detailed variant checklist */
  steps?: SyncProgressStep[];

  // === Meta Info ===
  /** Last sync timestamp */
  lastSyncDate?: Date;
  /** Additional last sync info (e.g., "46.9 GB") */
  lastSyncInfo?: string;

  // === Error State ===
  /** Error to display (string message or Error object) */
  error?: Error | string;

  // === Actions ===
  /** Handler for cancel button (button shown when provided) */
  onCancel?: () => void;
  /** Handler for retry button (button shown when provided in error state) */
  onRetry?: () => void;
  /** Handler for copy diagnostics button (shown in error state) */
  onCopyDiagnostics?: () => void;

  // === Styling ===
  /** Additional CSS classes to apply to root element */
  className?: string;
}

/**
 * Props for the SyncProgressSteps subcomponent
 */
export interface SyncProgressStepsProps {
  /** Array of steps to render */
  steps: SyncProgressStep[];
  /** Additional CSS classes */
  className?: string;
}
