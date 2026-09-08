/**
 * FdaHelpSheet — the ONE Full Disk Access explainer, for every dead-end
 * outside onboarding (BACKLOG-3210 part 2).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * Until BACKLOG-3208 nothing outside onboarding mentioned Full Disk Access at
 * all. 3208 added a notice to Settings → Messages, and its button opened the
 * raw macOS Privacy pane — a window with a list of apps, no explanation of
 * what Keepr wants or why, and no way back. BACKLOG-3219 makes the dashboard
 * health banner reachable for the same population, which would have produced a
 * second button into that same bare pane.
 *
 * The founder's instruction was to route both to the explanation the app
 * already has, the way an expired email token routes to a recovery surface
 * rather than to an OAuth error — the shape `SystemHealthMonitor` already uses
 * for `reconnect-google` / `reconnect-microsoft`: a short verb-first label, one
 * click, landing somewhere that explains.
 *
 * ---------------------------------------------------------------------------
 * THE MACOS PANE IS STILL REACHABLE — IT IS JUST NO LONGER THE FIRST THING
 * ---------------------------------------------------------------------------
 * The primary button here opens it, through the same trigger-then-open path
 * BACKLOG-3208 established (`systemService.openFullDiskAccessSettings`, which
 * pre-lists Keepr in the pane before opening it — BACKLOG-2192 established
 * that the trigger has to fire on every open, not once). Nothing about the
 * user's ability to get to System Settings is removed; it is preceded by the
 * explanation instead of substituting for it.
 *
 * ---------------------------------------------------------------------------
 * KNOWN LIMIT, STATED RATHER THAN HIDDEN
 * ---------------------------------------------------------------------------
 * `FdaSafetySheet` is the "why does Keepr need this, and is it safe" half of
 * the onboarding explainer. The step-by-step half — 3 numbered steps, the
 * ported macOS graphics, the "Keepr not in the list?" detour — lives in
 * `PermissionsStep` and is wired to that step's `onAction`, telemetry ref,
 * relaunch and poll. It is not extracted here, so a user who clicks
 * "Show me how" gets the reassurance and the button, not the walkthrough.
 * Filed as a follow-up rather than quietly accepted.
 *
 * @module components/permissions/FdaHelpSheet
 */

import React, { useCallback } from "react";
import { FdaSafetySheet } from "../onboarding/steps/FdaSafetySheet";
import { systemService } from "../../services";
import logger from "../../utils/logger";

export interface FdaHelpSheetProps {
  /** Close the explainer. Fired by "Not now" and by a backdrop click. */
  onClose: () => void;
  /**
   * Optional extra work after the macOS pane has been asked to open — e.g.
   * Settings re-checks its Full Disk Access status so the notice updates when
   * the user comes straight back. The sheet stays open either way: the user
   * needs it to still be there when they return from System Settings.
   */
  onOpenedSettings?: () => void | Promise<void>;
  /** data-testid for the modal overlay. Defaults to `fda-help-sheet`. */
  testId?: string;
}

/**
 * The post-onboarding Full Disk Access explainer.
 *
 * Composition, not a copy: the body is `FdaSafetySheet` verbatim, with the
 * labels and actions this context needs supplied through its optional props.
 * One definition, both dead-ends.
 */
export function FdaHelpSheet({
  onClose,
  onOpenedSettings,
  testId = "fda-help-sheet",
}: FdaHelpSheetProps): React.ReactElement {
  const handleOpenSystemSettings = useCallback(async () => {
    const result = await systemService.openFullDiskAccessSettings();
    if (!result.success) {
      // Non-fatal: the sheet stays open and the user can try again or follow
      // the written instructions. Reporting a failure we cannot act on would
      // be worse than leaving the explanation on screen.
      logger.error(
        "[FdaHelpSheet] Failed to open the Full Disk Access pane:",
        result.error
      );
    }
    if (onOpenedSettings) {
      await onOpenedSettings();
    }
  }, [onOpenedSettings]);

  return (
    <FdaSafetySheet
      testId={testId}
      // Primary — the way to the macOS pane, now preceded by the explanation.
      onLetsGo={() => {
        void handleOpenSystemSettings();
      }}
      primaryLabel="Open System Settings"
      // Secondary — plain dismissal. Outside onboarding there is no step to
      // skip, so "Skip for now" would name something that does not exist.
      onSkip={onClose}
      secondaryLabel="Not now"
      // Backdrop click must dismiss, NOT open System Settings. This is why
      // FdaSafetySheet needed an `onClose` separate from `onLetsGo`.
      onClose={onClose}
      // The restart is stated because it is TRUE HERE and was not in the first
      // draft of this copy. Onboarding relaunches itself the moment it detects
      // the grant (`PermissionsStep.relaunchForGrant`), so "macOS restarts
      // Keepr for you" reads correctly there and NOWHERE ELSE. macOS decides an
      // app's Full Disk Access when the process starts and does not revisit it,
      // so from Settings or the dashboard the running process stays denied
      // until it is restarted — which is exactly why BACKLOG-3208 put a
      // "restart Keepr to finish" notice in the Messages panel, one inch below
      // where this sheet opens. A footer promising an automatic restart would
      // have contradicted the panel behind it.
      footer={
        <>
          Switch Keepr on under Privacy &amp; Security &rarr; Full Disk Access,
          <br />
          then restart Keepr. Nothing is lost.
        </>
      }
    />
  );
}

export default FdaHelpSheet;
