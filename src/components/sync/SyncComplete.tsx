import React from 'react';
import type { SyncResult } from './types';

interface SyncCompleteProps {
  result: SyncResult;
  onContinue: () => void;
}

export const SyncComplete: React.FC<SyncCompleteProps> = ({
  result,
  onContinue
}) => {
  const durationMinutes = Math.round(result.duration / 60000);

  return (
    <div className="sync-complete">
      <div className="success-icon-container mb-4">
        <svg
          className="w-16 h-16 text-green-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <h3 className="text-lg font-medium mb-2">
        Sync Complete!
      </h3>

      <div className="sync-summary space-y-2 my-4">
        <div className="summary-row flex items-center gap-2 text-gray-700">
          <svg
            className="w-5 h-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          <span>{result.messagesCount.toLocaleString()} messages</span>
        </div>
        <div className="summary-row flex items-center gap-2 text-gray-700">
          <svg
            className="w-5 h-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <span>{result.contactsCount.toLocaleString()} contacts</span>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Completed in {durationMinutes} minute{durationMinutes !== 1 ? 's' : ''}
      </p>

      <button
        onClick={onContinue}
        className="btn-primary mt-4 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        View Messages
      </button>
    </div>
  );
};
