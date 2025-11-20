import React, { useState, useEffect } from 'react';
import type { Transaction } from '../../electron/types/models';

interface ExportModalProps {
  transaction: Transaction;
  userId: string;
  onClose: () => void;
  onExportComplete: (result: unknown) => void;
}

/**
 * ExportModal Component
 * Enhanced export with date verification, content/format selection
 */
function ExportModal({ transaction, userId, onClose, onExportComplete }: ExportModalProps) {
  const [step, setStep] = useState(1); // 1: Date Verification, 2: Export Options, 3: Exporting
  const [representationStartDate, setRepresentationStartDate] = useState(
    transaction.representation_start_date
      ? typeof transaction.representation_start_date === 'string'
        ? transaction.representation_start_date
        : transaction.representation_start_date.toISOString().split('T')[0]
      : ''
  );
  const [closingDate, setClosingDate] = useState(
    transaction.closing_date
      ? typeof transaction.closing_date === 'string'
        ? transaction.closing_date
        : transaction.closing_date.toISOString().split('T')[0]
      : ''
  );
  const [contentType, setContentType] = useState('both'); // text, email, both
  const [exportFormat, setExportFormat] = useState('pdf'); // pdf, excel, csv, json, txt_eml
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user preferences to set default export format
  useEffect(() => {
    const loadDefaultFormat = async () => {
      if (userId) {
        try {
          const result = await window.api.preferences.get(userId);
          if (result.success && result.preferences) {
            const prefs = result.preferences as { export?: { defaultFormat?: string } };
            if (prefs.export?.defaultFormat) {
              setExportFormat(prefs.export.defaultFormat);
            }
          }
        } catch (error) {
          console.error('Failed to load export format preference:', error);
          // If loading fails, keep the default 'pdf' format
        }
      }
    };

    loadDefaultFormat();
  }, [userId]);

  const handleDateVerification = () => {
    if (!representationStartDate || !closingDate) {
      setError('Please provide both dates to continue');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setStep(3);

    try {
      // Update transaction dates first
      await window.api.transactions.update(transaction.id, {
        representation_start_date: representationStartDate,
        closing_date: closingDate,
        closing_date_verified: 1,
      });

      // Export with the selected format (PDF or DOCX)
      const result = await window.api.transactions.exportEnhanced(transaction.id, exportFormat);

      if (result.success) {
        onExportComplete(result);
      } else {
        setError(result.error || 'Export failed');
        setStep(2);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setError(errorMessage);
      setStep(2);
    } finally {
      setExporting(false);
    }
  };

  const formatConfidence = (confidence?: number) => {
    if (!confidence) return null;
    if (confidence >= 80) return { text: 'High', color: 'text-green-600 bg-green-50' };
    if (confidence >= 50) return { text: 'Medium', color: 'text-yellow-600 bg-yellow-50' };
    return { text: 'Low', color: 'text-red-600 bg-red-50' };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-xl font-bold text-white">Export Transaction Audit</h3>
            <p className="text-purple-100 text-sm">{transaction.property_address}</p>
          </div>
          <button
            onClick={onClose}
            disabled={exporting}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all disabled:opacity-50"
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

          {/* Step 1: Date Verification */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Verify Transaction Dates</h4>
                <p className="text-sm text-gray-600 mb-6">
                  These dates will be used to filter communications included in your audit export.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Representation Start Date *
                    </label>
                    {transaction.representation_start_confidence && formatConfidence(transaction.representation_start_confidence) && (
                      <span className={`text-xs px-2 py-1 rounded ${formatConfidence(transaction.representation_start_confidence)!.color}`}>
                        Confidence: {formatConfidence(transaction.representation_start_confidence)!.text}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={representationStartDate}
                    onChange={(e) => setRepresentationStartDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    When did you sign the representation agreement with the client?
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Closing Date *
                    </label>
                    {transaction.closing_date_confidence && formatConfidence(transaction.closing_date_confidence) && (
                      <span className={`text-xs px-2 py-1 rounded ${formatConfidence(transaction.closing_date_confidence)!.color}`}>
                        Confidence: {formatConfidence(transaction.closing_date_confidence)!.text}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={closingDate}
                    onChange={(e) => setClosingDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    When did the transaction officially close?
                  </p>
                </div>
              </div>

              {transaction.first_communication_date && transaction.last_communication_date && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900 mb-2">Communication Date Range</p>
                  <p className="text-xs text-blue-700">
                    We found communications from{' '}
                    <span className="font-semibold">
                      {new Date(transaction.first_communication_date).toLocaleDateString()}
                    </span>{' '}
                    to{' '}
                    <span className="font-semibold">
                      {new Date(transaction.last_communication_date).toLocaleDateString()}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Export Options */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Export Options</h4>
                <p className="text-sm text-gray-600 mb-6">
                  Choose what content and format you'd like to export.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Content Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setContentType('text')}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      contentType === 'text'
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Text Only
                  </button>
                  <button
                    onClick={() => setContentType('email')}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      contentType === 'email'
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Email Only
                  </button>
                  <button
                    onClick={() => setContentType('both')}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      contentType === 'both'
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Both
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Export Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setExportFormat('pdf')}
                    className={`px-4 py-3 rounded-lg font-medium transition-all text-left ${
                      exportFormat === 'pdf'
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="font-semibold">PDF Report</div>
                    <div className="text-xs opacity-80">Transaction report only</div>
                  </button>
                  <button
                    onClick={() => setExportFormat('excel')}
                    className={`px-4 py-3 rounded-lg font-medium transition-all text-left ${
                      exportFormat === 'excel'
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="font-semibold">Excel (.xlsx)</div>
                    <div className="text-xs opacity-80">Spreadsheet format</div>
                  </button>
                  <button
                    onClick={() => setExportFormat('csv')}
                    className={`px-4 py-3 rounded-lg font-medium transition-all text-left ${
                      exportFormat === 'csv'
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="font-semibold">CSV</div>
                    <div className="text-xs opacity-80">Comma-separated values</div>
                  </button>
                  <button
                    onClick={() => setExportFormat('json')}
                    className={`px-4 py-3 rounded-lg font-medium transition-all text-left ${
                      exportFormat === 'json'
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="font-semibold">JSON</div>
                    <div className="text-xs opacity-80">Structured data</div>
                  </button>
                  <button
                    onClick={() => setExportFormat('txt_eml')}
                    className={`px-4 py-3 rounded-lg font-medium transition-all text-left col-span-2 ${
                      exportFormat === 'txt_eml'
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="font-semibold">TXT + EML Files</div>
                    <div className="text-xs opacity-80">Text files and email files in folders</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Exporting */}
          {step === 3 && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Exporting...</h4>
              <p className="text-sm text-gray-600">
                Creating your compliance audit export. This may take a moment.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 3 && (
          <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-between">
            <button
              onClick={step === 1 ? onClose : () => setStep(1)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            <button
              onClick={step === 1 ? handleDateVerification : handleExport}
              disabled={step === 1 && (!representationStartDate || !closingDate)}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                step === 1 && (!representationStartDate || !closingDate)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 shadow-md hover:shadow-lg'
              }`}
            >
              {step === 1 ? 'Next' : 'Export'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExportModal;
