/**
 * Custom hook for managing Joyride tour state
 * Handles tour initialization and completion
 */
import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

export function useTour(shouldStart, storageKey = 'hasSeenTour') {
  const [runTour, setRunTour] = useState(false);

  // Start tour when condition is met and user hasn't seen it
  useEffect(() => {
    if (shouldStart) {
      const hasSeenTour = localStorage.getItem(storageKey);
      if (!hasSeenTour) {
        setTimeout(() => setRunTour(true), 500);
      }
    }
  }, [shouldStart, storageKey]);

  const handleJoyrideCallback = (data) => {
    const { status } = data;
    const finishedStatuses = ['finished', 'skipped'];

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
