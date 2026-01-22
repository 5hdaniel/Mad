/**
 * ArchivePromptModal Component
 * Prompts user to archive transaction after export
 */
import React from "react";

interface ArchivePromptModalProps {
  onKeepActive: () => void;
  onArchive: () => void;
}

export function ArchivePromptModal({
  onKeepActive,
  onArchive,
}: ArchivePromptModalProps): React.ReactElement {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-3">
          Archive Transaction?
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Export completed! Would you like to mark this transaction as closed?
        </p>
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onKeepActive}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-all"
          >
            Keep Active
          </button>
          <button
            onClick={onArchive}
            className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 rounded-lg font-semibold transition-all"
          >
            Mark as Closed
          </button>
        </div>
      </div>
    </div>
  );
}
