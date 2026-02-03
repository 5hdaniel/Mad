/**
 * useOnboardingPersistence Hook
 *
 * TASK-1807: Persists onboarding progress to Supabase and local SQLite.
 * Watches the state machine for step completions and persists accordingly.
 *
 * - After each step completes: saves current_onboarding_step
 * - When reaching ready state: sets onboarding_completed_at
 *
 * Uses fire-and-forget pattern - errors are logged but don't block onboarding.
 *
 * @module appCore/state/flows/useOnboardingPersistence
 */

import { useEffect, useRef } from "react";
import { settingsService } from "@/services";
import { useOptionalMachineState } from "../machine";
import { selectIsDatabaseInitialized } from "../machine/selectors";

interface UseOnboardingPersistenceOptions {
  /** User ID for persistence operations */
  userId: string | undefined;
}

/**
 * Hook that automatically persists onboarding progress.
 *
 * This hook:
 * 1. Watches for completed steps in the state machine
 * 2. Persists the last completed step to Supabase (cloud)
 * 3. Persists to local SQLite when DB is initialized
 * 4. Sets onboarding_completed_at when all steps are done
 */
export function useOnboardingPersistence({
  userId,
}: UseOnboardingPersistenceOptions): void {
  const machineState = useOptionalMachineState();

  // Track the last persisted step to avoid duplicate saves
  const lastPersistedStepRef = useRef<string | null>(null);
  // Track if we've already marked onboarding complete
  const onboardingCompletedRef = useRef(false);

  useEffect(() => {
    if (!machineState || !userId) return;

    const { state } = machineState;

    // Case 1: User is in onboarding state - persist the last completed step
    if (state.status === "onboarding") {
      const completedSteps = state.completedSteps;

      // Get the last completed step
      const lastCompletedStep =
        completedSteps.length > 0
          ? completedSteps[completedSteps.length - 1]
          : null;

      // Only persist if we have a new completed step
      if (lastCompletedStep && lastCompletedStep !== lastPersistedStepRef.current) {
        lastPersistedStepRef.current = lastCompletedStep;

        // Fire-and-forget persistence - don't block the UI
        (async () => {
          try {
            // 1. Persist to Supabase (always available after auth)
            await settingsService.updateOnboardingStepCloud(userId, lastCompletedStep);

            // 2. Persist to local SQLite if DB is initialized
            const isDbReady = selectIsDatabaseInitialized(state);
            if (isDbReady) {
              await settingsService.updateOnboardingStep(userId, lastCompletedStep);
            }
          } catch (error) {
            // Log but don't throw - graceful degradation
            console.warn(
              "[useOnboardingPersistence] Failed to persist step:",
              error
            );
          }
        })();
      }
    }

    // Case 2: User just transitioned to ready state - mark onboarding complete
    if (state.status === "ready" && !onboardingCompletedRef.current) {
      onboardingCompletedRef.current = true;
      lastPersistedStepRef.current = null; // Reset for next session

      // Fire-and-forget persistence - don't block the UI
      (async () => {
        try {
          // 1. Mark complete in Supabase
          await settingsService.completeOnboardingCloud(userId);

          // 2. Mark complete in local SQLite
          await settingsService.completeOnboarding(userId);
        } catch (error) {
          // Log but don't throw - graceful degradation
          console.warn(
            "[useOnboardingPersistence] Failed to complete onboarding:",
            error
          );
        }
      })();
    }

    // Reset completion flag if user goes back to onboarding (e.g., START_EMAIL_SETUP)
    if (state.status === "onboarding" && onboardingCompletedRef.current) {
      onboardingCompletedRef.current = false;
    }
  }, [machineState, userId]);
}
