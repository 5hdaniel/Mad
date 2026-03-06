/**
 * IPhoneSyncContext
 *
 * Provides a single shared instance of useIPhoneSync to prevent
 * dual-instance bugs when multiple components need sync state.
 *
 * Without this context, each component calling useIPhoneSync() gets
 * its own independent useState/useEffect instances, causing:
 * - Double device detection
 * - Double IPC listeners
 * - Race conditions on stopDetection cleanup
 *
 * @module contexts/IPhoneSyncContext
 */

import React, { createContext, useContext } from "react";
import { useIPhoneSync } from "../hooks/useIPhoneSync";
import type { UseIPhoneSyncReturn } from "../types/iphone";

const IPhoneSyncContext = createContext<UseIPhoneSyncReturn | null>(null);

export function IPhoneSyncProvider({ children }: { children: React.ReactNode }) {
  const sync = useIPhoneSync();
  return (
    <IPhoneSyncContext.Provider value={sync}>
      {children}
    </IPhoneSyncContext.Provider>
  );
}

/**
 * Consumer hook for IPhoneSync context.
 * Must be used within an IPhoneSyncProvider.
 */
export function useIPhoneSyncContext(): UseIPhoneSyncReturn {
  const ctx = useContext(IPhoneSyncContext);
  if (!ctx) {
    throw new Error("useIPhoneSyncContext must be used within IPhoneSyncProvider");
  }
  return ctx;
}
