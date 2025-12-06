import React, { useState } from 'react';
import type { SuggestedTransaction } from '../../electron/types/models';

interface SuggestedTransactionModalProps {
  suggestion: SuggestedTransaction;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (data: unknown) => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
  formatCurrency: (amount: number | undefined) => string;
  formatDate: (date: string | Date | undefined) => string;
}

/**
 * SuggestedTransactionModal Component
 * Shows full suggested transaction details with edit capability
 */
function SuggestedTransactionModal({
  suggestion,
  isOpen,
  onClose,
  onApprove,
  onReject,
  formatCurrency,
  formatDate,
}: SuggestedTransactionModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState({
    property_address: suggestion.property_address || '',
    property_street: suggestion.property_street || '',
    property_city: suggestion.property_city || '',
    property_state: suggestion.property_state || '',
    property_zip: suggestion.property_zip || '',
    transaction_type: suggestion.transaction_type || '',
    closing_date: suggestion.closing_date ? new Date(suggestion.closing_date).toISOString().split('T')[0] : '',
    sale_price: suggestion.sale_price?.toString() || '',
    listing_price: suggestion.listing_price?.toString() || '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleApprove = async () => {
    try {
      setIsApproving(true);
      const approvalData = {
        property_address: formData.property_address,
        property_street: formData.property_street,
        property_city: formData.property_city,
        property_state: formData.property_state,
        property_zip: formData.property_zip,
        transaction_type: formData.transaction_type || undefined,
        closing_date: formData.closing_date || undefined,
        sale_price: formData.sale_price ? parseFloat(formData.sale_price) : undefined,
        listing_price: formData.listing_price ? parseFloat(formData.listing_price) : undefined,
      };
      await onApprove(approvalData);
      onClose();
    } catch (err) {
      console.error('Approval failed:', err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    try {
      setIsRejecting(true);
      await onReject(rejectReason || undefined);
      onClose();
    } catch (err) {
      console.error('Rejection failed:', err);
    } finally {
      setIsRejecting(false);
      setShowRejectForm(false);
      setRejectReason('');
    }
  };

  if (!isOpen) return null;

  const isAddressComplete =
    formData.property_address &&
    formData.property_city &&
    formData.property_state &&
    formData.property_zip;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between border-b border-amber-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-white text-amber-700 text-xs font-bold">
                SUGGESTED
              </span>
              {suggestion.extraction_confidence !== undefined && (
                <span className="text-sm font-medium text-white">
                  {suggestion.extraction_confidence}% Confidence
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white">
              {suggestion.property_address || 'New Transaction'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Mode Toggle */}
          {!showRejectForm && (
            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    !isEditing
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  View
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    isEditing
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Edit
                </button>
              </div>
            </div>
          )}

          {/* Form or View Mode */}
          {!showRejectForm ? (
            <div className="space-y-4">
              {/* Property Address - Always prominent */}
              <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Property Address *
                  {!isAddressComplete && !isEditing && (
                    <span className="ml-2 text-red-600 font-bold">REQUIRED</span>
                  )}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="property_address"
                    value={formData.property_address}
                    onChange={handleInputChange}
                    placeholder="e.g., 123 Main Street"
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                ) : (
                  <p className={`text-lg font-semibold ${suggestion.property_address ? 'text-gray-900' : 'text-orange-700'}`}>
                    {suggestion.property_address || '❌ Not provided'}
                  </p>
                )}
              </div>

              {/* Address Components Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Street</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="property_street"
                      value={formData.property_street}
                      onChange={handleInputChange}
                      placeholder="123 Main St"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{formData.property_street || 'N/A'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">City</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="property_city"
                      value={formData.property_city}
                      onChange={handleInputChange}
                      placeholder="New York"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{formData.property_city || 'N/A'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">State</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="property_state"
                      value={formData.property_state}
                      onChange={handleInputChange}
                      placeholder="NY"
                      maxLength={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{formData.property_state || 'N/A'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ZIP</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="property_zip"
                      value={formData.property_zip}
                      onChange={handleInputChange}
                      placeholder="10001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{formData.property_zip || 'N/A'}</p>
                  )}
                </div>
              </div>

              {/* Transaction Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Transaction Type</label>
                  {isEditing ? (
                    <select
                      name="transaction_type"
                      value={formData.transaction_type}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select...</option>
                      <option value="purchase">Purchase</option>
                      <option value="sale">Sale</option>
                    </select>
                  ) : (
                    <p className="text-gray-900 font-medium capitalize">
                      {formData.transaction_type || 'N/A'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Closing Date</label>
                  {isEditing ? (
                    <input
                      type="date"
                      name="closing_date"
                      value={formData.closing_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">
                      {formData.closing_date ? formatDate(formData.closing_date) : 'N/A'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Sale Price</label>
                  {isEditing ? (
                    <input
                      type="number"
                      name="sale_price"
                      value={formData.sale_price}
                      onChange={handleInputChange}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">
                      {formData.sale_price ? formatCurrency(parseFloat(formData.sale_price)) : 'N/A'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Listing Price</label>
                  {isEditing ? (
                    <input
                      type="number"
                      name="listing_price"
                      value={formData.listing_price}
                      onChange={handleInputChange}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">
                      {formData.listing_price ? formatCurrency(parseFloat(formData.listing_price)) : 'N/A'}
                    </p>
                  )}
                </div>
              </div>

              {/* Detected Contacts */}
              {suggestion.detected_contacts && suggestion.detected_contacts.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Detected Contacts</label>
                  <div className="flex flex-wrap gap-2">
                    {suggestion.detected_contacts.map((contact, idx) => (
                      <div
                        key={idx}
                        className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm"
                      >
                        <p className="font-medium text-gray-900">{contact.name}</p>
                        {contact.email && (
                          <p className="text-xs text-gray-600">{contact.email}</p>
                        )}
                        {contact.role && (
                          <p className="text-xs text-blue-700 font-medium">{contact.role}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email count */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-600 font-medium">Source</p>
                <p className="text-sm font-semibold text-gray-900">
                  {suggestion.communications_count} email{suggestion.communications_count !== 1 ? 's' : ''} scanned
                </p>
              </div>
            </div>
          ) : (
            /* Reject Reason Form */
            <div className="space-y-4">
              <p className="text-gray-700">Why are you rejecting this suggested transaction?</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Optional: Add a reason for rejection..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px]"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            {!showRejectForm ? (
              <>
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="flex-1 px-4 py-2 border-2 border-red-300 text-red-700 rounded-lg font-semibold hover:bg-red-50 transition-all"
                >
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  disabled={!isAddressComplete || isApproving}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    !isAddressComplete || isApproving
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  {isApproving && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  {isApproving ? 'Approving...' : 'Approve & Save'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >
                  Keep
                </button>
                <button
                  onClick={handleReject}
                  disabled={isRejecting}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    isRejecting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  {isRejecting && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  {isRejecting ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SuggestedTransactionModal;
