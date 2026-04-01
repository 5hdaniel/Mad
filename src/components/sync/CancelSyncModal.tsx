import React from "react";
import { ResponsiveModal } from "../common/ResponsiveModal";

interface CancelSyncModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CancelSyncModal: React.FC<CancelSyncModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <ResponsiveModal onClose={onCancel} overlayClassName="bg-black bg-opacity-50" panelClassName="max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-2">Cancel Sync?</h2>
        <p className="text-gray-600 mb-4">
          The sync is still in progress. If you cancel now, no data will be
          saved and you'll need to start over.
        </p>
        <div className="modal-actions flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="btn-secondary px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Continue Sync
          </button>
          <button
            onClick={onConfirm}
            className="btn-danger px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Cancel Sync
          </button>
        </div>
    </ResponsiveModal>
  );
};
