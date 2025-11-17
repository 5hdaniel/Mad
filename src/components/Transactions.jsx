import React, { useState, useEffect } from 'react';
import AuditTransactionModal from './AuditTransactionModal';
import ExportModal from './ExportModal';

/**
 * Transactions Component
 * Main transaction management interface
 * Lists transactions, triggers scans, shows progress
 */
function Transactions({ userId, provider, onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active'); // active, closed, all
  const [showAuditCreate, setShowAuditCreate] = useState(false);

  useEffect(() => {
    loadTransactions();

    // Listen for scan progress
    if (window.api?.onTransactionScanProgress) {
      window.api.onTransactionScanProgress(handleScanProgress);
    }
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const result = await window.api.transactions.getAll(userId);

      if (result.success) {
        setTransactions(result.transactions || []);
      } else {
        setError(result.error || 'Failed to load transactions');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleScanProgress = (progress) => {
    setScanProgress(progress);
  };

  const startScan = async () => {
    try {
      setScanning(true);
      setError(null);
      setScanProgress({ step: 'starting', message: 'Starting scan...' });

      const result = await window.api.transactions.scan(userId, {
        provider,
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year back
        endDate: new Date(),
      });

      if (result.success) {
        setScanProgress({
          step: 'complete',
          message: `Found ${result.transactionsFound} transactions from ${result.emailsScanned} emails!`,
        });

        // Reload transactions
        await loadTransactions();
      } else {
        setError(result.error || 'Scan failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
      setTimeout(() => setScanProgress(null), 3000);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch = t.property_address?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && t.status === 'active') ||
      (statusFilter === 'closed' && t.status === 'closed');
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-6 flex items-center justify-between shadow-lg">
        <button
          onClick={onClose}
          className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg px-4 py-2 transition-all flex items-center gap-2 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </button>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-white">Transactions</h2>
          <p className="text-blue-100 text-sm">{transactions.length} properties found</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 p-6 bg-white shadow-md">
          {/* Status Filter Toggle */}
          <div className="inline-flex items-center bg-gray-200 rounded-lg p-1 mb-3">
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                statusFilter === 'active'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Active ({transactions.filter((t) => t.status === 'active').length})
            </button>
            <button
              onClick={() => setStatusFilter('closed')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                statusFilter === 'closed'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Closed ({transactions.filter((t) => t.status === 'closed').length})
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All ({transactions.length})
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search by address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg
                className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Audit New Transaction Button */}
            <button
              onClick={() => setShowAuditCreate(true)}
              className="px-4 py-2 rounded-lg font-semibold transition-all bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Transaction
            </button>

            {/* Scan Button */}
            <button
              onClick={startScan}
              disabled={scanning}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                scanning
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-md hover:shadow-lg'
              }`}
            >
              {scanning ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Scanning...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  Scan Emails
                </span>
              )}
            </button>
          </div>

          {/* Scan Progress */}
          {scanProgress && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                {scanProgress.step !== 'complete' && (
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                )}
                {scanProgress.step === 'complete' && (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <span className="text-sm font-medium text-blue-900">{scanProgress.message}</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
      </div>

      {/* Transactions List */}
      <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading transactions...</p>
              </div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <svg
                  className="w-16 h-16 text-gray-300 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchQuery ? 'No matching transactions' : 'No transactions yet'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery
                    ? 'Try adjusting your search'
                    : 'Click "Scan Emails" to extract real estate transactions from your emails, or audit a new transaction manually.'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setShowAuditCreate(true)}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all font-semibold shadow-md hover:shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Audit new transaction
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-6">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-blue-400 hover:shadow-xl transition-all cursor-pointer transform hover:scale-[1.01]"
                  onClick={() => setSelectedTransaction(transaction)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{transaction.property_address}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {transaction.transaction_type && (
                          <span className="flex items-center gap-1">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                transaction.transaction_type === 'purchase' ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                            ></span>
                            {transaction.transaction_type === 'purchase' ? 'Purchase' : 'Sale'}
                          </span>
                        )}
                        {transaction.sale_price && (
                          <span className="font-semibold text-gray-900">{formatCurrency(transaction.sale_price)}</span>
                        )}
                        {transaction.closing_date && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            Closed: {formatDate(transaction.closing_date)}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                          {transaction.total_communications_count || 0} emails
                        </span>
                        {transaction.extraction_confidence && (
                          <span className="flex items-center gap-1">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${transaction.extraction_confidence}%` }}
                              ></div>
                            </div>
                            {transaction.extraction_confidence}% confidence
                          </span>
                        )}
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <TransactionDetails
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onTransactionUpdated={loadTransactions}
        />
      )}

      {/* Audit Transaction Creation Modal */}
      {showAuditCreate && (
        <AuditTransactionModal
          userId={userId}
          provider={provider}
          onClose={() => setShowAuditCreate(false)}
          onSuccess={(newTransaction) => {
            setShowAuditCreate(false);
            loadTransactions();
          }}
        />
      )}
    </div>
  );
}

/**
 * Transaction Details Modal
 * Shows full details of a single transaction
 */
function TransactionDetails({ transaction, onClose, onTransactionUpdated }) {
  const [communications, setCommunications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(null);
  const [showArchivePrompt, setShowArchivePrompt] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadDetails();
  }, [transaction.id]);

  const loadDetails = async () => {
    try {
      setLoading(true);
      const result = await window.api.transactions.getDetails(transaction.id);

      if (result.success) {
        setCommunications(result.transaction.communications || []);
      }
    } catch (err) {
      console.error('Failed to load details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportComplete = (result) => {
    setShowExportModal(false);
    setExportSuccess(result.path || 'Export completed successfully!');
    // Auto-hide success message after 5 seconds
    setTimeout(() => setExportSuccess(null), 5000);

    // Show archive prompt if transaction is still active
    if (transaction.status === 'active') {
      setShowArchivePrompt(true);
    }
  };

  const handleArchive = async () => {
    try {
      await window.api.transactions.update(transaction.id, { status: 'closed' });
      setShowArchivePrompt(false);
      if (onTransactionUpdated) {
        onTransactionUpdated();
      }
    } catch (err) {
      console.error('Failed to archive transaction:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-green-500 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-xl font-bold text-white">Transaction Details</h3>
            <p className="text-green-100 text-sm">{transaction.property_address}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Edit Button */}
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-white text-blue-600 hover:bg-opacity-90 shadow-md hover:shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
            {/* Export Button */}
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-white text-green-600 hover:bg-opacity-90 shadow-md hover:shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export
            </button>
            {/* Close Button */}
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Success Message */}
        {exportSuccess && (
          <div className="flex-shrink-0 mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">PDF exported successfully!</p>
                <p className="text-xs text-green-700 mt-1 break-all">{exportSuccess}</p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Transaction Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Sale Price</p>
              <p className="text-xl font-bold text-gray-900">
                {transaction.sale_price
                  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                      transaction.sale_price
                    )
                  : 'N/A'}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Closing Date</p>
              <p className="text-xl font-bold text-gray-900">
                {transaction.closing_date ? new Date(transaction.closing_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>

          {/* Communications */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Related Emails ({communications.length})</h4>
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : communications.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No emails found</p>
            ) : (
              <div className="space-y-3">
                {communications.map((comm) => (
                  <div key={comm.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-semibold text-gray-900">{comm.subject || '(No Subject)'}</h5>
                      <span className="text-xs text-gray-500">
                        {comm.sent_at ? new Date(comm.sent_at).toLocaleDateString() : 'Unknown date'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">From: {comm.sender || 'Unknown'}</p>
                    {comm.body_plain && (
                      <p className="text-sm text-gray-700 line-clamp-3">{comm.body_plain.substring(0, 200)}...</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          transaction={transaction}
          onClose={() => setShowExportModal(false)}
          onExportComplete={handleExportComplete}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <EditTransactionModal
          transaction={transaction}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            if (onTransactionUpdated) {
              onTransactionUpdated();
            }
          }}
        />
      )}

      {/* Archive Prompt */}
      {showArchivePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Archive Transaction?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Export completed! Would you like to mark this transaction as closed?
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
    </div>
  );
}

/**
 * Edit Transaction Modal
 * Allows editing transaction details
 */
function EditTransactionModal({ transaction, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    property_address: transaction.property_address || '',
    transaction_type: transaction.transaction_type || 'purchase',
    representation_start_date: transaction.representation_start_date || '',
    closing_date: transaction.closing_date || '',
    sale_price: transaction.sale_price || '',
    listing_price: transaction.listing_price || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSave = async () => {
    if (!formData.property_address.trim()) {
      setError('Property address is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updates = {
        property_address: formData.property_address.trim(),
        transaction_type: formData.transaction_type,
        representation_start_date: formData.representation_start_date || null,
        closing_date: formData.closing_date || null,
        sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
        listing_price: formData.listing_price ? parseFloat(formData.listing_price) : null,
      };

      const result = await window.api.transactions.update(transaction.id, updates);

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || 'Failed to update transaction');
      }
    } catch (err) {
      setError(err.message || 'Failed to update transaction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-xl sticky top-0 z-10">
          <h3 className="text-xl font-bold text-white">Edit Transaction</h3>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Property Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Property Address *
            </label>
            <input
              type="text"
              value={formData.property_address}
              onChange={(e) => handleChange('property_address', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Transaction Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleChange('transaction_type', 'purchase')}
                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                  formData.transaction_type === 'purchase'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Purchase
              </button>
              <button
                onClick={() => handleChange('transaction_type', 'sale')}
                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                  formData.transaction_type === 'sale'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Sale
              </button>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Representation Start Date
              </label>
              <input
                type="date"
                value={formData.representation_start_date}
                onChange={(e) => handleChange('representation_start_date', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Closing Date
              </label>
              <input
                type="date"
                value={formData.closing_date}
                onChange={(e) => handleChange('closing_date', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sale Price
              </label>
              <input
                type="number"
                value={formData.sale_price}
                onChange={(e) => handleChange('sale_price', e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Listing Price
              </label>
              <input
                type="number"
                value={formData.listing_price}
                onChange={(e) => handleChange('listing_price', e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center gap-3 justify-end sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              saving
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-md hover:shadow-lg'
            }`}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Transactions;
