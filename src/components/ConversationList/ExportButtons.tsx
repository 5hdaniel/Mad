/**
 * ExportButtons Component
 * Provides export action buttons (All, Emails Only, Texts Only)
 */
import React from 'react';

interface ExportButtonsProps {
  outlookConnected: boolean;
  selectedCount: number;
  isExporting: boolean;
  onExportAll: () => void;
  onExportEmailsOnly: () => void;
  onExportTextsOnly: () => void;
  onConnectOutlook: () => void;
}

export function ExportButtons({
  outlookConnected,
  selectedCount,
  isExporting,
  onExportAll,
  onExportEmailsOnly,
  onExportTextsOnly,
  onConnectOutlook
}: ExportButtonsProps) {
  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50" data-tour="export-section">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Export</h3>
      <div className="flex gap-3">
        {/* All (Messages + Emails) */}
        {outlookConnected ? (
          <button
            data-tour="export-all"
            onClick={onExportAll}
            disabled={selectedCount === 0 || isExporting}
            className="flex-1 bg-primary text-white py-2.5 px-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            All
          </button>
        ) : (
          <button
            data-tour="export-all"
            onClick={onConnectOutlook}
            className="flex-1 bg-blue-50 border-2 border-blue-300 text-blue-700 py-2.5 px-4 rounded-lg font-semibold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            All
          </button>
        )}

        {/* Only Emails */}
        {outlookConnected ? (
          <button
            data-tour="export-emails"
            onClick={onExportEmailsOnly}
            disabled={selectedCount === 0 || isExporting}
            className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-2.5 px-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Only Emails
          </button>
        ) : (
          <button
            data-tour="export-emails"
            disabled
            className="flex-1 bg-gray-100 border-2 border-gray-200 text-gray-400 py-2.5 px-4 rounded-lg font-semibold cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Only Emails
          </button>
        )}

        {/* Only Texts */}
        <button
          data-tour="export-texts"
          onClick={onExportTextsOnly}
          disabled={selectedCount === 0 || isExporting}
          className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-2.5 px-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          Only Texts
        </button>
      </div>
    </div>
  );
}
