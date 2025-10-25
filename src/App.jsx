import React, { useState, useEffect } from 'react';
import PermissionsScreen from './components/PermissionsScreen';
import ConversationList from './components/ConversationList';
import ExportComplete from './components/ExportComplete';

function App() {
  const [currentStep, setCurrentStep] = useState('permissions'); // permissions, conversations, complete
  const [hasPermissions, setHasPermissions] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [showVersion, setShowVersion] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const result = await window.electron.checkPermissions();
    if (result.hasPermission) {
      setHasPermissions(true);
      setCurrentStep('conversations');
    }
  };

  const handlePermissionsGranted = () => {
    setHasPermissions(true);
    setCurrentStep('conversations');
  };

  const handleExportComplete = (result) => {
    setExportResult(result);
    setCurrentStep('complete');
  };

  const handleStartOver = () => {
    setExportResult(null);
    setCurrentStep('conversations');
  };

  const getPageTitle = () => {
    switch (currentStep) {
      case 'permissions':
        return 'Setup Permissions';
      case 'conversations':
        return 'Select Conversations';
      case 'complete':
        return 'Export Complete';
      default:
        return 'Real Estate Archive';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Title Bar */}
      <div className="flex-shrink-0 bg-gradient-to-b from-gray-100 to-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-center select-none">
        <h1 className="text-sm font-semibold text-gray-700">{getPageTitle()}</h1>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto relative">
        {currentStep === 'permissions' && (
          <PermissionsScreen
            onPermissionsGranted={handlePermissionsGranted}
            onCheckAgain={checkPermissions}
          />
        )}

        {currentStep === 'conversations' && (
          <ConversationList onExportComplete={handleExportComplete} />
        )}

        {currentStep === 'complete' && (
          <ExportComplete
            result={exportResult}
            onStartOver={handleStartOver}
          />
        )}

        {/* Version Info Button - Bottom Left */}
        <button
          onClick={() => setShowVersion(!showVersion)}
          className="fixed bottom-4 left-4 w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-800 transition-all shadow-md z-50"
          title="Version Info"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Version Info Popup */}
        {showVersion && (
          <div className="fixed bottom-16 left-4 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 min-w-64">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">App Info</h3>
              <button
                onClick={() => setShowVersion(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Version:</span>
                <span className="font-mono font-semibold text-gray-900">1.0.1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Update:</span>
                <span className="font-mono text-gray-700">Contact Fix</span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-gray-500 text-xs">
                  Real Estate Archive MVP
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
