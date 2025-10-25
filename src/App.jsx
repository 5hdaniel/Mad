import React, { useState, useEffect } from 'react';
import PermissionsScreen from './components/PermissionsScreen';
import ConversationList from './components/ConversationList';
import ExportComplete from './components/ExportComplete';

function App() {
  const [currentStep, setCurrentStep] = useState('permissions'); // permissions, conversations, complete
  const [hasPermissions, setHasPermissions] = useState(false);
  const [exportResult, setExportResult] = useState(null);

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
      <div className="flex-1 overflow-y-auto">
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
      </div>
    </div>
  );
}

export default App;
