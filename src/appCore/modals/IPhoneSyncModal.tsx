/**
 * IPhoneSyncModal Component
 *
 * Wraps IPhoneSyncFlow in a modal overlay with close button.
 * Extracted from AppModals.tsx to keep the orchestrator under 150 lines.
 */

import React from "react";
import IPhoneSyncFlow from "../../components/iphone/IPhoneSyncFlow";

interface IPhoneSyncModalProps {
  onClose: () => void;
}

export function IPhoneSyncModal({ onClose }: IPhoneSyncModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <div className="flex justify-end p-4 pb-0">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <IPhoneSyncFlow onClose={onClose} />
      </div>
    </div>
  );
}
