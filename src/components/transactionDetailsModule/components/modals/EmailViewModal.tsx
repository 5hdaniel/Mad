/**
 * EmailViewModal Component
 * Full email view modal for communications
 */
import React from "react";
import type { Communication } from "../../types";

interface EmailViewModalProps {
  email: Communication;
  onClose: () => void;
  onRemoveFromTransaction: () => void;
}

export function EmailViewModal({
  email,
  onClose,
  onRemoveFromTransaction,
}: EmailViewModalProps): React.ReactElement {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        {/* Email Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 rounded-t-xl">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h3 className="text-lg font-bold text-white">
                {email.subject || "(No Subject)"}
              </h3>
              <p className="text-blue-100 text-sm mt-1">
                {email.sent_at
                  ? new Date(email.sent_at).toLocaleString()
                  : "Unknown date"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Email Metadata */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-sm font-medium text-gray-500 w-16">From:</span>
              <span className="text-sm text-gray-900">
                {email.sender || "Unknown"}
              </span>
            </div>
            {(email as any).recipients && (
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-gray-500 w-16">To:</span>
                <span className="text-sm text-gray-900">
                  {(email as any).recipients}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Email Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {email.body_plain ? (
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                {email.body_plain}
              </pre>
            </div>
          ) : (
            <p className="text-gray-500 italic text-center py-8">
              No email content available
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex items-center justify-between">
            <button
              onClick={onRemoveFromTransaction}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-all flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
              Remove from Transaction
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 rounded-lg font-semibold transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
