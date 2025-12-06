import React from 'react';
import type { ConnectionStatusProps } from '../../types/iphone';
import { TrustComputerHint } from './TrustComputerHint';

/**
 * ConnectionStatus Component
 * Displays iPhone connection status and provides sync action
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  device,
  onSyncClick,
}) => {
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        {/* Disconnected Phone Icon */}
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-800">Connect Your iPhone</h3>
        <p className="text-gray-500 mt-2 max-w-sm">
          Connect your iPhone using a USB cable to sync messages and contacts.
        </p>
        <TrustComputerHint />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      {/* Connected Phone Icon */}
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-gray-800">
        {device?.name || 'iPhone'}
      </h3>
      <p className="text-sm text-gray-500 mt-1">
        iOS {device?.productVersion}
      </p>
      <button
        onClick={onSyncClick}
        className="mt-6 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
      >
        Sync Messages & Contacts
      </button>
    </div>
  );
};

export default ConnectionStatus;
