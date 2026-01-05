/**
 * AddressVerificationStep Component
 * Step 1 of the AuditTransactionModal - Address input and verification
 * Extracted from AuditTransactionModal as part of TASK-974 decomposition
 */
import React from "react";
import type { AddressData, AddressSuggestion } from "../../hooks/useAuditTransaction";

interface AddressVerificationStepProps {
  addressData: AddressData;
  onAddressChange: (value: string) => void;
  onTransactionTypeChange: (type: string) => void;
  showAutocomplete: boolean;
  suggestions: AddressSuggestion[];
  onSelectSuggestion: (suggestion: AddressSuggestion) => void;
}

function AddressVerificationStep({
  addressData,
  onAddressChange,
  onTransactionTypeChange,
  showAutocomplete,
  suggestions,
  onSelectSuggestion,
}: AddressVerificationStepProps): React.ReactElement {
  return (
    <div className="space-y-6">
      <div>
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

      <div>
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
              Address Verification
            </p>
            <p className="text-xs text-blue-700 mt-1">
              We'll verify the address using Google Places API to ensure
              accuracy for reports and exports.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddressVerificationStep;
