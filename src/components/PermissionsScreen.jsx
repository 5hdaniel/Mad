import React, { useState } from 'react';

function PermissionsScreen({ onPermissionsGranted, onCheckAgain }) {
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckPermissions = async () => {
    setIsChecking(true);
    const result = await window.electron.checkPermissions();
    setIsChecking(false);

    if (result.hasPermission) {
      onPermissionsGranted();
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Grant Permissions</h1>
          <p className="text-gray-600">
            To export your messages, this app needs access to your Messages database
          </p>
        </div>

        <div className="space-y-6 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-primary text-white rounded-full text-sm mr-2">1</span>
              Open System Preferences
            </h2>
            <p className="text-sm text-gray-700 ml-8">
              Go to <strong>System Preferences</strong> (or <strong>System Settings</strong> on newer macOS)
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-primary text-white rounded-full text-sm mr-2">2</span>
              Navigate to Privacy Settings
            </h2>
            <p className="text-sm text-gray-700 ml-8">
              Click on <strong>Security & Privacy</strong> → <strong>Privacy</strong> → <strong>Full Disk Access</strong>
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-primary text-white rounded-full text-sm mr-2">3</span>
              Add This App
            </h2>
            <p className="text-sm text-gray-700 ml-8">
              Click the <strong>+</strong> button and add <strong>Real Estate Archive</strong> to the list
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-primary text-white rounded-full text-sm mr-2">4</span>
              Enable Access
            </h2>
            <p className="text-sm text-gray-700 ml-8">
              Check the box next to <strong>Real Estate Archive</strong> to enable full disk access
            </p>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> You may need to restart this app after granting permissions
            </p>
          </div>
        </div>

        <button
          onClick={handleCheckPermissions}
          disabled={isChecking}
          className="w-full bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isChecking ? 'Checking...' : 'I\'ve Granted Permissions'}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          We'll never share your data. All exports are stored locally on your device.
        </p>
      </div>
    </div>
  );
}

export default PermissionsScreen;
