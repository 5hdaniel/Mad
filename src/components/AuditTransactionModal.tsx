import React from "react";
import { AUDIT_WORKFLOW_STEPS } from "../constants/contactRoles";
import AddressVerificationStep from "./audit/AddressVerificationStep";
import ContactAssignmentStep from "./audit/ContactAssignmentStep";
import type { Transaction } from "../../electron/types/models";
import { useAppStateMachine } from "../appCore";
import { useAuditTransaction } from "../hooks/useAuditTransaction";

// Type definitions
interface AuditTransactionModalProps {
  userId: string;
  provider?: string; // Optional - not currently used
  onClose: () => void;
  onSuccess: (transaction: Transaction) => void;
  editTransaction?: Transaction; // For edit mode - pre-fill from existing transaction
}

/**
 * Audit Transaction Modal
 * Comprehensive transaction creation with address verification and contact assignment
 */
function AuditTransactionModal({
  userId,
  provider: _provider,
  onClose,
  onSuccess,
  editTransaction,
}: AuditTransactionModalProps): React.ReactElement {
  // Database initialization guard (belt-and-suspenders defense)
  const { isDatabaseInitialized } = useAppStateMachine();

  // Use the extracted hook for all state and handlers
  const {
    step,
    loading,
    error,
    isEditing,
    addressData,
    contactAssignments,
    showAddressAutocomplete,
    addressSuggestions,
    setAddressData,
    handleAddressChange,
    selectAddress,
    assignContact,
    removeContact,
    handleNextStep,
    handlePreviousStep,
  } = useAuditTransaction({
    userId,
    editTransaction,
    onClose,
    onSuccess,
  });

  // DEFENSIVE CHECK: Return loading state if database not initialized
  // Should never trigger if AppShell gate works, but prevents errors if bypassed
  if (!isDatabaseInitialized) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-500 text-sm">Waiting for database...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-white">
              {isEditing ? "Edit Transaction Details" : "Audit New Transaction"}
            </h2>
            <p className="text-indigo-100 text-sm">
              {isEditing ? (
                "Update property address and transaction dates"
              ) : (
                <>
                  {step === 1 && "Step 1: Transaction Details"}
                  {step === 2 && "Step 2: Assign Client & Agents"}
                  {step === 3 && "Step 3: Assign Professional Services"}
                </>
              )}
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

        {/* Progress Bar - Only show for new transactions */}
        {!isEditing && (
          <div className="flex-shrink-0 bg-gray-100 px-3 sm:px-6 py-3">
            <div className="flex items-center justify-center gap-1 sm:gap-2 mb-2 max-w-md mx-auto">
              {[1, 2, 3].map((s: number) => (
                <React.Fragment key={s}>
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-semibold transition-all ${
                      s < step
                        ? "bg-green-500 text-white"
                        : s === step
                          ? "bg-indigo-500 text-white"
                          : "bg-gray-300 text-gray-600"
                    }`}
                  >
                    {s < step ? "✓" : s}
                  </div>
                  {s < 3 && (
                    <div
                      className={`flex-1 h-1 transition-all ${s < step ? "bg-green-500" : "bg-gray-300"}`}
                    ></div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex-shrink-0 mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <AddressVerificationStep
              addressData={addressData}
              onAddressChange={handleAddressChange}
              onTransactionTypeChange={(type) =>
                setAddressData({ ...addressData, transaction_type: type })
              }
              onStartDateChange={(date) =>
                setAddressData({ ...addressData, started_at: date })
              }
              onEndDateChange={(date) =>
                setAddressData({ ...addressData, closed_at: date })
              }
              showAutocomplete={showAddressAutocomplete}
              suggestions={addressSuggestions}
              onSelectSuggestion={selectAddress}
            />
          )}

          {step === 2 && (
            <ContactAssignmentStep
              stepConfig={AUDIT_WORKFLOW_STEPS[0]}
              contactAssignments={contactAssignments}
              onAssignContact={assignContact}
              onRemoveContact={removeContact}
              userId={userId}
              transactionType={addressData.transaction_type}
              propertyAddress={addressData.property_address}
            />
          )}

          {step === 3 && (
            <ContactAssignmentStep
              stepConfig={AUDIT_WORKFLOW_STEPS[1]}
              contactAssignments={contactAssignments}
              onAssignContact={assignContact}
              onRemoveContact={removeContact}
              userId={userId}
              transactionType={addressData.transaction_type}
              propertyAddress={addressData.property_address}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 bg-gray-50 rounded-b-xl flex items-center gap-3 justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={handlePreviousStep}
                disabled={loading}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleNextStep}
              disabled={loading}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                loading
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-md hover:shadow-lg"
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {isEditing ? "Saving..." : "Creating..."}
                </span>
              ) : isEditing ? (
                "Save Changes"
              ) : step === 3 ? (
                "Create Transaction"
              ) : (
                "Continue →"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuditTransactionModal;
