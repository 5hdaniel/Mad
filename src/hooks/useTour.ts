/**
 * Custom hook for managing Joyride tour state
 * Handles tour initialization and completion
 */
import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import confetti from 'canvas-confetti';

/**
 * Joyride callback data structure
 */
export interface JoyrideCallbackData {
  status: 'finished' | 'skipped' | 'error' | 'running' | 'ready' | 'idle';
  type?: string;
  index?: number;
  action?: string;
  controlled?: boolean;
  lifecycle?: string;
  size?: number;
  step?: unknown;
}

/**
 * Return type for useTour hook
 */
export interface UseTourReturn {
  runTour: boolean;
  setRunTour: Dispatch<SetStateAction<boolean>>;
  handleJoyrideCallback: (data: JoyrideCallbackData) => void;
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

  const handleJoyrideCallback = (data: JoyrideCallbackData): void => {
    const { status } = data;
    const finishedStatuses: JoyrideCallbackData['status'][] = ['finished', 'skipped'];

    if (finishedStatuses.includes(status)) {
      setRunTour(false);
      localStorage.setItem(storageKey, 'true');

      // Trigger confetti when tour is completed (not skipped)
      if (status === 'finished') {
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
