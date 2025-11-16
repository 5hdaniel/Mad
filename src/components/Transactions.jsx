import React, { useState, useEffect } from 'react';

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

  const filteredTransactions = transactions.filter((t) =>
    t.property_address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-white">Transactions</h2>
            <p className="text-blue-100 text-sm">{transactions.length} properties found</p>
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

        {/* Toolbar */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gray-50">
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
        <div className="flex-1 overflow-y-auto p-4">
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
                    : 'Click "Scan Emails" to extract real estate transactions from your emails.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
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
      </div>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <TransactionDetails transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} />
      )}
    </div>
  );
}

/**
 * Transaction Details Modal
 * Shows full details of a single transaction
 */
function TransactionDetails({ transaction, onClose }) {
  const [communications, setCommunications] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-green-500 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-xl font-bold text-white">Transaction Details</h3>
            <p className="text-green-100 text-sm">{transaction.property_address}</p>
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
    </div>
  );
}

export default Transactions;
