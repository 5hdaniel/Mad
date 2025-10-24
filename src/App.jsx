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

  return (
    <div className="h-screen bg-gray-50 overflow-hidden">
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
  );
}

export default App;
