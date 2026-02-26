/**
 * AddressVerificationStep Component
 * Step 1 of the AuditTransactionModal - Address input and verification
 * Extracted from AuditTransactionModal as part of TASK-974 decomposition
 *
 * TASK-1974: Added Auto/Manual toggle for start date auto-detection
 */
import React from "react";
import type { AddressData, AddressSuggestion } from "../../hooks/useAuditTransaction";

interface AddressVerificationStepProps {
  addressData: AddressData;
  onAddressChange: (value: string) => void;
  onTransactionTypeChange: (type: string) => void;
  onStartDateChange: (date: string) => void;
  onClosingDateChange: (date: string | undefined) => void;
  onEndDateChange: (date: string | undefined) => void;
  showAutocomplete: boolean;
  suggestions: AddressSuggestion[];
  onSelectSuggestion: (suggestion: AddressSuggestion) => void;
  // Auto-detect start date props (TASK-1974)
  startDateMode?: "auto" | "manual";
  onStartDateModeChange?: (mode: "auto" | "manual") => void;
  autoDetectedDate?: string | null | undefined;
  isAutoDetecting?: boolean;
}

/**
 * Format a date string (YYYY-MM-DD) to readable format (e.g., "Sep 1, 2019")
 */
function formatDateReadable(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AddressVerificationStep({
  addressData,
  onAddressChange,
  onTransactionTypeChange,
  onStartDateChange,
  onClosingDateChange,
  onEndDateChange,
  showAutocomplete,
  suggestions,
  onSelectSuggestion,
  startDateMode = "manual",
  onStartDateModeChange,
  autoDetectedDate,
  isAutoDetecting = false,
}: AddressVerificationStepProps): React.ReactElement {
  const isAutoMode = startDateMode === "auto";
  const hasAutoDate = isAutoMode && autoDetectedDate !== null && autoDetectedDate !== undefined;
  const showNoCommsHint = isAutoMode && !isAutoDetecting && autoDetectedDate === null;
  const awaitingContacts = isAutoMode && !hasAutoDate && !showNoCommsHint && !isAutoDetecting;
  const todayFormatted = formatDateReadable(new Date().toISOString().split("T")[0]);

  return (
    <div className="space-y-6">
      <div data-tour="audit-address">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Property Address *
        </label>
        <div className="relative">
          <input
            type="text"
            value={addressData.property_address}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onAddressChange(e.target.value)
            }
            placeholder="Enter property address..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            autoComplete="off"
          />
          {showAutocomplete && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map(
                (suggestion: AddressSuggestion, index: number) => (
                  <button
                    key={suggestion.place_id || suggestion.placeId || index}
                    onClick={() => onSelectSuggestion(suggestion)}
                    className="w-full text-left px-4 py-2 hover:bg-indigo-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <p className="font-medium text-gray-900">
                      {suggestion.main_text ||
                        suggestion.description ||
                        "Address"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {suggestion.secondary_text || ""}
                    </p>
                  </button>
                ),
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Start typing to see verified addresses from Google Places
        </p>
      </div>

      <div data-tour="audit-transaction-type">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Transaction Type *
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onTransactionTypeChange("purchase")}
            className={`px-4 py-3 rounded-lg font-medium transition-all ${
              addressData.transaction_type === "purchase"
                ? "bg-indigo-500 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Purchase
          </button>
          <button
            onClick={() => onTransactionTypeChange("sale")}
            className={`px-4 py-3 rounded-lg font-medium transition-all ${
              addressData.transaction_type === "sale"
                ? "bg-indigo-500 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Sale
          </button>
        </div>
      </div>

      {/* Transaction Dates - hidden until start date preference loads */}
      {startDateMode === undefined ? (
        <div className="h-24" />
      ) : (
      <div data-tour="audit-dates">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700">
            {isAutoMode ? "Audit Period" : "Transaction Dates"}
          </label>
          {/* Auto/Manual toggle (TASK-1974, TASK-1980) - hidden until preference loads */}
          {onStartDateModeChange && startDateMode && (
            <div className="flex items-center gap-1" title="Auto: detect from earliest communication. Manual: enter date yourself.">
              <button
                type="button"
                onClick={() => onStartDateModeChange("auto")}
                title="Auto: detect start date from earliest communication"
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  isAutoMode
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => onStartDateModeChange("manual")}
                title="Manual: enter the representation start date yourself"
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  !isAutoMode
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Manual
              </button>
            </div>
          )}
        </div>

        {/* Auto mode: formatted audit period display */}
        {isAutoMode && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 mb-4">
            {isAutoDetecting ? (
              <div className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4 text-indigo-500"
                  xmlns="http://www.w3.org/2000/svg"
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
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-sm text-indigo-700">
                  Detecting start representation date...
                </span>
              </div>
            ) : awaitingContacts ? (
              <div>
                <p className="text-sm font-medium text-indigo-900">
                  auto <span className="text-indigo-500">(pending...)</span>{" "}
                  <span className="text-indigo-400">—</span>{" "}
                  {todayFormatted}
                </p>
                <p className="text-xs text-indigo-600 mt-1">
                  Representation start date will be set after selecting contacts in Step 2
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-indigo-900">
                  auto{" "}
                  <span className="text-indigo-700">
                    ({formatDateReadable(addressData.started_at)})
                  </span>{" "}
                  <span className="text-indigo-400">—</span>{" "}
                  {todayFormatted}
                </p>
                {hasAutoDate && (
                  <p className="text-xs text-indigo-600 mt-1">
                    Start representation date based on earliest client communication
                  </p>
                )}
                {showNoCommsHint && (
                  <p className="text-xs text-amber-600 mt-1">
                    No communications found for representation start date — using default (60 days ago)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Manual mode: start date input */}
        {!isAutoMode && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Representation Start Date *
              <span
                className="ml-1 text-gray-400 cursor-help"
                title="The date you officially started representing this client in this transaction"
              >
                (?)
              </span>
            </label>
            <input
              type="date"
              value={addressData.started_at}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onStartDateChange(e.target.value)
              }
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                !addressData.started_at
                  ? "border-red-300 bg-red-50"
                  : "border-gray-300"
              }`}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Required — The date you began representing this client
            </p>
          </div>
        )}

        {/* Closing date and end date — always visible */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Closing Date
            </label>
            <input
              type="date"
              value={addressData.closing_deadline || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onClosingDateChange(e.target.value || undefined)
              }
              min={addressData.started_at}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Scheduled closing date
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={addressData.closed_at || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onEndDateChange(e.target.value || undefined)
              }
              min={addressData.started_at}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              When transaction ended
            </p>
          </div>
        </div>
      </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <svg
            className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-900">
              About Date Range
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Messages will be linked to this transaction only if they fall
              within the specified date range. This prevents linking unrelated
              older messages.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddressVerificationStep;
