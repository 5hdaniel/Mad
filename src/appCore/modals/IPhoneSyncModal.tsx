/**
 * IPhoneSyncModal Component
 *
 * Wraps IPhoneSyncFlow in a modal overlay with close button.
 * Extracted from AppModals.tsx to keep the orchestrator under 150 lines.
 */

import React, { useEffect } from "react";
import { IPhoneSyncFlow } from "../../components/iphone/IPhoneSyncFlow";
import logger from "../../utils/logger";

interface IPhoneSyncModalProps {
  onClose: () => void;
}

export function IPhoneSyncModal({ onClose }: IPhoneSyncModalProps) {
  useEffect(() => {
    logger.info("[IPhoneSyncModal] Mounted");
    return () => logger.info("[IPhoneSyncModal] Unmounted");
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Minimize button — dismisses modal without stopping sync */}
        <div className="flex justify-end p-4 pb-0">
          <button
            onClick={() => { logger.info("[IPhoneSyncModal] Minimize clicked"); onClose(); }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Minimize — sync continues in background"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <IPhoneSyncFlow onClose={onClose} onSyncStarted={onClose} />
      </div>
    </div>
  );
}
