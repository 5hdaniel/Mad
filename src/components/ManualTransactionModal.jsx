import React, { useState } from 'react';

/**
 * ManualTransactionModal Component
 * Allows users to manually create a transaction by entering address and details
 */
function ManualTransactionModal({ userId, provider, onClose, onSuccess }) {
  const [propertyAddress, setPropertyAddress] = useState('');
  const [representationStartDate, setRepresentationStartDate] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [transactionType, setTransactionType] = useState('purchase');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: Address, 2: Dates

  const handleSave = async () => {
    if (!propertyAddress.trim()) {
      setError('Property address is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Create transaction via IPC
      const result = await window.api.transactions.create(userId, {
        property_address: propertyAddress.trim(),
        transaction_type: transactionType,
        representation_start_date: representationStartDate || null,
        closing_date: closingDate || null,
        status: 'active',
      });

      if (result.success) {
        onSuccess(result.transaction);
        onClose();
      } else {
        setError(result.error || 'Failed to create transaction');
      }
    } catch (err) {
      setError(err.message || 'Failed to create transaction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-xl font-bold text-white">Create New Transaction</h3>
            <p className="text-green-100 text-sm">Step {step} of 2</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Property Address *
                </label>
                <input
                  type="text"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  placeholder="123 Main St, City, State 12345"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter the full property address for this transaction
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setTransactionType('purchase')}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      transactionType === 'purchase'
                        ? 'bg-green-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Purchase
                  </button>
                  <button
                    onClick={() => setTransactionType('sale')}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      transactionType === 'sale'
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Sale
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">Dates are optional</p>
                    <p className="text-xs text-blue-700 mt-1">
                      You can add dates now or later. We'll also try to auto-detect them from communications.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Representation Start Date
                </label>
                <input
                  type="date"
                  value={representationStartDate}
                  onChange={(e) => setRepresentationStartDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  When did you sign the representation agreement?
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Closing Date
                </label>
                <input
                  type="date"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  When did the transaction officially close?
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Transaction Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Address:</span>
                    <span className="font-medium text-gray-900">{propertyAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium text-gray-900 capitalize">{transactionType}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-between">
          <button
            onClick={step === 1 ? onClose : () => setStep(1)}
            disabled={saving}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all disabled:opacity-50"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          <button
            onClick={step === 1 ? () => setStep(2) : handleSave}
            disabled={saving || !propertyAddress.trim()}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              saving || !propertyAddress.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-500 to-teal-600 text-white hover:from-green-600 hover:to-teal-700 shadow-md hover:shadow-lg'
            }`}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating...
              </span>
            ) : step === 1 ? (
              'Next'
            ) : (
              'Create Transaction'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManualTransactionModal;
