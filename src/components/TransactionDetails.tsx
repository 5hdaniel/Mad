import React, { useState, useEffect } from "react";
import type { Transaction, Communication } from "@/types";
import ExportModal from "./ExportModal";

interface ContactAssignment {
  id: string;
  contact_id: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_company?: string;
  role?: string;
  specific_role?: string;
  is_primary?: number;
  notes?: string;
}

interface TransactionDetailsComponentProps {
  transaction: Transaction;
  onClose: () => void;
  onTransactionUpdated?: () => void;
}

/**
 * TransactionDetails Component
 * Shows full details of a single transaction
 */
function TransactionDetails({
  transaction,
  onClose,
  onTransactionUpdated,
}: TransactionDetailsComponentProps) {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [contactAssignments, setContactAssignments] = useState<
    ContactAssignment[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [showArchivePrompt, setShowArchivePrompt] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"details" | "contacts">("details");
  const [unlinkingCommId, setUnlinkingCommId] = useState<string | null>(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] =
    useState<Communication | null>(null);
  const [viewingEmail, setViewingEmail] = useState<Communication | null>(null);

  useEffect(() => {
    loadDetails();
  }, [transaction.id]);

  const loadDetails = async (): Promise<void> => {
    try {
      setLoading(true);
      const result = await window.api.transactions.getDetails(transaction.id);

      if (result.success) {
        setCommunications((result.transaction as any).communications || []);
        setContactAssignments(
          (result.transaction as any).contact_assignments || [],
        );
      }
    } catch (err) {
      console.error("Failed to load details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportComplete = (result: unknown): void => {
    const exportResult = result as { path?: string };
    setShowExportModal(false);
    setExportSuccess(exportResult.path || "Export completed successfully!");
    // Auto-hide success message after 5 seconds
    setTimeout(() => setExportSuccess(null), 5000);

    // Show archive prompt if transaction is still active
    if (transaction.status === "active") {
      setShowArchivePrompt(true);
    }
  };

  const handleArchive = async (): Promise<void> => {
    try {
      await window.api.transactions.update(transaction.id, {
        status: "closed",
      });
      setShowArchivePrompt(false);
      if (onTransactionUpdated) {
        onTransactionUpdated();
      }
    } catch (err) {
      console.error("Failed to archive transaction:", err);
    }
  };

  const handleDelete = async (): Promise<void> => {
    try {
      await window.api.transactions.delete(transaction.id);
      setShowDeleteConfirm(false);
      onClose(); // Close the details modal
      if (onTransactionUpdated) {
        onTransactionUpdated(); // Refresh the transaction list
      }
    } catch (err) {
      console.error("Failed to delete transaction:", err);
      alert("Failed to delete transaction. Please try again.");
    }
  };

  const handleUnlinkCommunication = async (
    comm: Communication,
  ): Promise<void> => {
    try {
      setUnlinkingCommId(comm.id);
      const result = await window.api.transactions.unlinkCommunication(comm.id);

      if (result.success) {
        // Remove the communication from the local state
        setCommunications((prev) => prev.filter((c) => c.id !== comm.id));
        setShowUnlinkConfirm(null);
      } else {
        console.error("Failed to unlink communication:", result.error);
        alert("Failed to unlink email. Please try again.");
      }
    } catch (err) {
      console.error("Failed to unlink communication:", err);
      alert("Failed to unlink email. Please try again.");
    } finally {
      setUnlinkingCommId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-green-500 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-xl font-bold text-white">
              Transaction Details
            </h3>
            <p className="text-green-100 text-sm">
              {transaction.property_address}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Export Button */}
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-white text-green-600 hover:bg-opacity-90 shadow-md hover:shadow-lg"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export
            </button>
            {/* Delete Button */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-white text-red-600 hover:bg-opacity-90 shadow-md hover:shadow-lg"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete
            </button>
            {/* Close Button */}
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

        {/* Success Message */}
        {exportSuccess && (
          <div className="flex-shrink-0 mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">
                  PDF exported successfully!
                </p>
                <p className="text-xs text-green-700 mt-1 break-all">
                  {exportSuccess}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex-shrink-0 border-b border-gray-200 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("details")}
              className={`px-4 py-3 font-medium text-sm transition-all ${
                activeTab === "details"
                  ? "border-b-2 border-green-500 text-green-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Transaction Details
            </button>
            <button
              onClick={() => setActiveTab("contacts")}
              className={`px-4 py-3 font-medium text-sm transition-all ${
                activeTab === "contacts"
                  ? "border-b-2 border-green-500 text-green-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Roles & Contacts ({contactAssignments.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "details" && (
            <>
              {/* Transaction Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Sale Price</p>
                  <p className="text-xl font-bold text-gray-900">
                    {transaction.sale_price
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                        }).format(transaction.sale_price)
                      : "N/A"}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Closing Date</p>
                  <p className="text-xl font-bold text-gray-900">
                    {transaction.closing_date
                      ? new Date(transaction.closing_date).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              </div>

              {/* Communications */}
              {communications.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">
                    Related Emails ({communications.length})
                  </h4>
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {communications.map((comm) => (
                        <div
                          key={comm.id}
                          className="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-colors"
                          onClick={() => setViewingEmail(comm)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-semibold text-gray-900 flex-1 pr-4">
                              {comm.subject || "(No Subject)"}
                            </h5>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-gray-500">
                                {comm.sent_at
                                  ? new Date(comm.sent_at).toLocaleDateString()
                                  : "Unknown date"}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowUnlinkConfirm(comm);
                                }}
                                disabled={unlinkingCommId === comm.id}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                title="Remove this email from transaction"
                              >
                                {unlinkingCommId === comm.id ? (
                                  <svg
                                    className="w-4 h-4 animate-spin"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    ></circle>
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                  </svg>
                                ) : (
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
                                )}
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            From: {comm.sender || "Unknown"}
                          </p>
                          {comm.body_plain && (
                            <p className="text-sm text-gray-700 line-clamp-3">
                              {comm.body_plain.substring(0, 200)}...
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === "contacts" && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Contact Assignments
              </h4>
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : contactAssignments.length === 0 ? (
                <p className="text-gray-600 text-center py-8">
                  No contacts assigned to this transaction
                </p>
              ) : (
                <div className="space-y-4">
                  {contactAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                              {assignment.specific_role ||
                                assignment.role ||
                                "Unknown Role"}
                            </span>
                            {assignment.is_primary === 1 && (
                              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                                Primary
                              </span>
                            )}
                          </div>
                          <h5 className="font-semibold text-gray-900 text-lg">
                            {assignment.contact_name || "Unknown Contact"}
                          </h5>
                          {assignment.contact_email && (
                            <p className="text-sm text-gray-600 mt-1">
                              <svg
                                className="w-4 h-4 inline mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                              </svg>
                              {assignment.contact_email}
                            </p>
                          )}
                          {assignment.contact_phone && (
                            <p className="text-sm text-gray-600 mt-1">
                              <svg
                                className="w-4 h-4 inline mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                />
                              </svg>
                              {assignment.contact_phone}
                            </p>
                          )}
                          {assignment.contact_company && (
                            <p className="text-sm text-gray-600 mt-1">
                              <svg
                                className="w-4 h-4 inline mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                />
                              </svg>
                              {assignment.contact_company}
                            </p>
                          )}
                          {assignment.notes && (
                            <p className="text-sm text-gray-700 mt-2 italic">
                              Note: {assignment.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          transaction={transaction}
          userId={transaction.user_id}
          onClose={() => setShowExportModal(false)}
          onExportComplete={handleExportComplete}
        />
      )}

      {/* Archive Prompt */}
      {showArchivePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              Archive Transaction?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Export completed! Would you like to mark this transaction as
              closed?
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowArchivePrompt(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-all"
              >
                Keep Active
              </button>
              <button
                onClick={handleArchive}
                className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 rounded-lg font-semibold transition-all"
              >
                Mark as Closed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Delete Transaction?
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Are you sure you want to delete this transaction? This will
              permanently remove:
            </p>
            <ul className="text-sm text-gray-600 mb-6 ml-6 list-disc">
              <li>
                Transaction details for{" "}
                <strong>{transaction.property_address}</strong>
              </li>
              <li>All contact assignments</li>
              <li>All related communications</li>
            </ul>
            <p className="text-sm text-red-600 font-semibold mb-6">
              This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-semibold transition-all"
              >
                Delete Transaction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlink Email Confirmation */}
      {showUnlinkConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-orange-600"
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
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Remove Email from Transaction?
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Are you sure this email is not related to this transaction?
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-gray-900 truncate">
                {showUnlinkConfirm.subject || "(No Subject)"}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                From: {showUnlinkConfirm.sender || "Unknown"}
              </p>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              This email will be removed from this transaction and won&apos;t be
              re-added during future email scans.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowUnlinkConfirm(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUnlinkCommunication(showUnlinkConfirm)}
                disabled={unlinkingCommId === showUnlinkConfirm.id}
                className="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {unlinkingCommId === showUnlinkConfirm.id ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Removing...
                  </>
                ) : (
                  "Remove Email"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Email View Modal */}
      {viewingEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col">
            {/* Email Header */}
            <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 rounded-t-xl">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <h3 className="text-lg font-bold text-white">
                    {viewingEmail.subject || "(No Subject)"}
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">
                    {viewingEmail.sent_at
                      ? new Date(viewingEmail.sent_at).toLocaleString()
                      : "Unknown date"}
                  </p>
                </div>
                <button
                  onClick={() => setViewingEmail(null)}
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
                  <span className="text-sm font-medium text-gray-500 w-16">
                    From:
                  </span>
                  <span className="text-sm text-gray-900">
                    {viewingEmail.sender || "Unknown"}
                  </span>
                </div>
                {viewingEmail.recipients && (
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium text-gray-500 w-16">
                      To:
                    </span>
                    <span className="text-sm text-gray-900">
                      {viewingEmail.recipients}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Email Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {viewingEmail.body_plain ? (
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                    {viewingEmail.body_plain}
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
                  onClick={() => {
                    setViewingEmail(null);
                    setShowUnlinkConfirm(viewingEmail);
                  }}
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
                  onClick={() => setViewingEmail(null)}
                  className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 rounded-lg font-semibold transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TransactionDetails;
