import React from 'react';

/**
 * Dashboard Component
 * Main landing screen after login
 * Provides three primary actions: Start New Audit, Browse Transactions, and Manage Contacts
 */
function Dashboard({ onAuditNew, onViewTransactions, onManageContacts }) {
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
          {/* Start New Audit Card */}
          <button
            onClick={onAuditNew}
            className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-8 text-left border-2 border-transparent hover:border-blue-500 transform hover:scale-105"
          >
            <div className="absolute top-6 right-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            <div className="pr-24">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Start New Audit
              </h2>
            </div>

            <div className="mt-6 flex items-center gap-2 text-blue-600 font-semibold group-hover:gap-4 transition-all">
              <span>Start Audit</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Browse Transactions Card */}
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
                Browse Transactions
              </h2>
            </div>

            <div className="mt-6 flex items-center gap-2 text-green-600 font-semibold group-hover:gap-4 transition-all">
              <span>View All</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        {/* Manage Contacts Card */}
        <div className="mt-8">
          <button
            onClick={onManageContacts}
            className="group w-full relative bg-white bg-opacity-70 backdrop-blur rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-left border-2 border-transparent hover:border-purple-400 transform hover:scale-[1.02]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Manage Contacts</h3>
              </div>
              <svg className="w-5 h-5 text-purple-600 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
