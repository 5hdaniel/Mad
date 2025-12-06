/**
 * Custom hook for managing Joyride tour state
 * Handles tour initialization and completion
 */
import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { CallBackProps, STATUS, ACTIONS } from 'react-joyride';
import confetti from 'canvas-confetti';

/**
 * Return type for useTour hook
 */
export interface UseTourReturn {
  runTour: boolean;
  setRunTour: Dispatch<SetStateAction<boolean>>;
  handleJoyrideCallback: (data: CallBackProps) => void;
}

/**
 * Custom hook for managing Joyride tour state
 * @param shouldStart - Condition to determine if tour should start
 * @param storageKey - localStorage key to track if user has seen tour
 * @returns Tour state and handlers
 */
export function useTour(shouldStart: boolean, storageKey: string = 'hasSeenTour'): UseTourReturn {
  const [runTour, setRunTour] = useState<boolean>(false);

  // Start tour when condition is met and user hasn't seen it
  useEffect(() => {
    if (shouldStart) {
      const hasSeenTour = localStorage.getItem(storageKey);
      if (!hasSeenTour) {
        setTimeout(() => setRunTour(true), 500);
      }
    }
  }, [shouldStart, storageKey]);

  const handleJoyrideCallback = (data: CallBackProps): void => {
    const { status, action } = data;

    // Handle tour completion, skip, or close (X button)
    const isFinishedOrSkipped = status === STATUS.FINISHED || status === STATUS.SKIPPED;
    const isClosed = action === ACTIONS.CLOSE;

    if (isFinishedOrSkipped || isClosed) {
      setRunTour(false);
      localStorage.setItem(storageKey, 'true');

      // Trigger confetti when tour is completed (not skipped or closed)
      if (status === STATUS.FINISHED) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }
  };

  return {
    runTour,
    setRunTour,
    handleJoyrideCallback
  };
}
