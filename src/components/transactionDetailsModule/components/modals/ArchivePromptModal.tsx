/**
 * ArchivePromptModal Component
 * Prompts user to archive transaction after export
 */
import React from "react";
import { ResponsiveModal } from "../../../common/ResponsiveModal";

interface ArchivePromptModalProps {
  onKeepActive: () => void;
  onArchive: () => void;
}

export function ArchivePromptModal({
  onKeepActive,
  onArchive,
}: ArchivePromptModalProps): React.ReactElement {
  return (
    <ResponsiveModal onClose={onKeepActive} zIndex="z-[70]" panelClassName="max-w-md p-6">
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
    </ResponsiveModal>
  );
}
