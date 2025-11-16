import React from 'react';

/**
 * Dashboard Component
 * Main landing screen after login
 * Provides two primary actions: Audit New Transaction or View Existing Transactions
 */
function Dashboard({ onAuditNew, onViewTransactions }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-8">
      <div className="max-w-5xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Welcome to Magic Audit
          </h1>
          <p className="text-lg text-gray-600">
            Real estate transaction compliance made simple
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Audit New Transaction Card */}
          <button
            onClick={onAuditNew}
            className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-8 text-left border-2 border-transparent hover:border-blue-500 transform hover:scale-105"
          >
            <div className="absolute top-6 right-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>

            <div className="pr-24">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Audit New Transaction
              </h2>
              <p className="text-gray-600 mb-6">
                Create a new transaction audit by manually entering details or scanning your emails for transaction data.
              </p>

              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Manual entry with address</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Auto-scan emails</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Assign contacts & roles</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-blue-600 font-semibold group-hover:gap-4 transition-all">
              <span>Get Started</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* View Transactions Card */}
          <button
            onClick={onViewTransactions}
            className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-8 text-left border-2 border-transparent hover:border-green-500 transform hover:scale-105"
          >
            <div className="absolute top-6 right-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>

            <div className="pr-24">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                View Transactions
              </h2>
              <p className="text-gray-600 mb-6">
                Browse all your transaction audits, filter by status, and export compliance reports.
              </p>

              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>View active & closed transactions</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Edit transaction details</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Export compliance reports</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-green-600 font-semibold group-hover:gap-4 transition-all">
              <span>View All</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        {/* Quick Stats (Optional - can be populated later) */}
        <div className="mt-12 grid grid-cols-3 gap-6">
          <div className="bg-white bg-opacity-60 backdrop-blur rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-1">—</div>
            <div className="text-sm text-gray-600">Active Transactions</div>
          </div>
          <div className="bg-white bg-opacity-60 backdrop-blur rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-1">—</div>
            <div className="text-sm text-gray-600">Completed Audits</div>
          </div>
          <div className="bg-white bg-opacity-60 backdrop-blur rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-1">—</div>
            <div className="text-sm text-gray-600">Total Transactions</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
