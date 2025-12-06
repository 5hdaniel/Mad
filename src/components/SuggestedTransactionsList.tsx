import React from 'react';
import type { SuggestedTransaction } from '../../electron/types/models';

interface SuggestedTransactionsListProps {
  suggestedTransactions: SuggestedTransaction[];
  onSelectTransaction: (suggestion: SuggestedTransaction) => void;
  formatCurrency: (amount: number | undefined) => string;
  formatDate: (date: string | Date | undefined) => string;
}

/**
 * SuggestedTransactionsList Component
 * Displays pending suggested transactions for user review
 */
function SuggestedTransactionsList({
  suggestedTransactions,
  onSelectTransaction,
  formatCurrency,
  formatDate,
}: SuggestedTransactionsListProps) {
  if (suggestedTransactions.length === 0) {
    return null;
  }

  const getConfidenceColor = (confidence: number | undefined): string => {
    if (!confidence) return 'bg-gray-100';
    if (confidence >= 80) return 'bg-green-100';
    if (confidence >= 60) return 'bg-yellow-100';
    return 'bg-orange-100';
  };

  const getConfidenceTextColor = (confidence: number | undefined): string => {
    if (!confidence) return 'text-gray-700';
    if (confidence >= 80) return 'text-green-700';
    if (confidence >= 60) return 'text-yellow-700';
    return 'text-orange-700';
  };

  return (
    <div className="mb-8">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">
            {suggestedTransactions.length}
          </span>
          Suggested Transactions
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Review and approve suggested transactions that need additional information
        </p>
      </div>

      <div className="grid gap-4">
        {suggestedTransactions.map((suggestion: SuggestedTransaction) => (
          <div
            key={suggestion.id}
            onClick={() => onSelectTransaction(suggestion)}
            className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-5 hover:border-amber-400 hover:shadow-lg transition-all cursor-pointer transform hover:scale-[1.01]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {/* Header with badge */}
                <div className="flex items-start gap-3 mb-2">
                  <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-200 text-amber-800 text-xs font-semibold">
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    SUGGESTED
                  </div>
                  {suggestion.extraction_confidence !== undefined && (
                    <div
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getConfidenceColor(suggestion.extraction_confidence)} ${getConfidenceTextColor(suggestion.extraction_confidence)}`}
                    >
                      {suggestion.extraction_confidence}% Confidence
                    </div>
                  )}
                </div>

                {/* Property address - highlight if missing */}
                <h3
                  className={`font-semibold mb-2 ${
                    suggestion.property_address ? 'text-gray-900' : 'text-orange-700'
                  }`}
                >
                  {suggestion.property_address ? suggestion.property_address : '📍 Missing Address'}
                </h3>

                {/* Details grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {/* Transaction Type */}
                  {suggestion.transaction_type && (
                    <div className="bg-white rounded-lg p-2 border border-amber-100">
                      <p className="text-gray-500 text-xs font-medium">Type</p>
                      <p className="text-gray-900 font-semibold capitalize">
                        {suggestion.transaction_type}
                      </p>
                    </div>
                  )}

                  {/* Sale Price */}
                  {suggestion.sale_price && (
                    <div className="bg-white rounded-lg p-2 border border-amber-100">
                      <p className="text-gray-500 text-xs font-medium">Price</p>
                      <p className="text-gray-900 font-semibold">
                        {formatCurrency(suggestion.sale_price)}
                      </p>
                    </div>
                  )}

                  {/* Closing Date */}
                  {suggestion.closing_date && (
                    <div className="bg-white rounded-lg p-2 border border-amber-100">
                      <p className="text-gray-500 text-xs font-medium">Closing</p>
                      <p className="text-gray-900 font-semibold">
                        {formatDate(suggestion.closing_date)}
                      </p>
                    </div>
                  )}

                  {/* Email Count */}
                  <div className="bg-white rounded-lg p-2 border border-amber-100">
                    <p className="text-gray-500 text-xs font-medium">Emails</p>
                    <p className="text-gray-900 font-semibold">
                      {suggestion.communications_count}
                    </p>
                  </div>
                </div>

                {/* Detected Parties */}
                {suggestion.detected_contacts && suggestion.detected_contacts.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-amber-100">
                    <p className="text-xs font-medium text-gray-600 mb-2">Detected Contacts:</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestion.detected_contacts.map((contact, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-gray-700 text-xs border border-amber-100"
                        >
                          <span className="font-medium">{contact.name}</span>
                          {contact.role && <span className="text-gray-500">({contact.role})</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action indicator */}
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-white border-2 border-amber-200 hover:border-amber-400 transition-all">
                <svg
                  className="w-5 h-5 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SuggestedTransactionsList;
