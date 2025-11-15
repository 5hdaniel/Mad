import React, { useState, useEffect } from 'react';
import MicrosoftLogin from './components/MicrosoftLogin';
import PermissionsScreen from './components/PermissionsScreen';
import ConversationList from './components/ConversationList';
import ExportComplete from './components/ExportComplete';
import OutlookExport from './components/OutlookExport';
import UpdateNotification from './components/UpdateNotification';
import MoveAppPrompt from './components/MoveAppPrompt';

function App() {
  const [currentStep, setCurrentStep] = useState('microsoft-login'); // microsoft-login, permissions, contacts, outlook, complete
  const [hasPermissions, setHasPermissions] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [showVersion, setShowVersion] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationIds, setSelectedConversationIds] = useState(new Set());
  const [showMoveAppPrompt, setShowMoveAppPrompt] = useState(false);
  const [appPath, setAppPath] = useState('');

  useEffect(() => {
    checkPermissions();
    checkAppLocation();
  }, []);

  const checkPermissions = async () => {
    const result = await window.electron.checkPermissions();
    if (result.hasPermission) {
      setHasPermissions(true);
    }
  };

  const checkAppLocation = async () => {
    try {
      const result = await window.electron.checkAppLocation();
      setAppPath(result.appPath || '');

      // Check if we should show the prompt
      // Only show if:
      // 1. shouldPrompt is true (not in Applications and in temp location)
      // 2. User hasn't dismissed it permanently
      const hasIgnored = localStorage.getItem('ignoreMoveAppPrompt');
      if (result.shouldPrompt && !hasIgnored) {
        setShowMoveAppPrompt(true);
      }
    } catch (error) {
      console.error('Error checking app location:', error);
    }
  };

  const handleDismissMovePrompt = () => {
    setShowMoveAppPrompt(false);
  };

  const handleNotNowMovePrompt = () => {
    setShowMoveAppPrompt(false);
  };

  const handleMicrosoftLogin = (userInfo) => {
    setOutlookConnected(true);
    // Check if we already have permissions
    if (hasPermissions) {
      setCurrentStep('contacts');
    } else {
      setCurrentStep('permissions');
    }
  };

  const handleMicrosoftSkip = () => {
    setOutlookConnected(false);
    // Check if we already have permissions
    if (hasPermissions) {
      setCurrentStep('contacts');
    } else {
      setCurrentStep('permissions');
    }
  };

  const handleConnectOutlook = () => {
    // Navigate back to Microsoft login screen
    setCurrentStep('microsoft-login');
  };

  const handlePermissionsGranted = () => {
    setHasPermissions(true);
    setCurrentStep('contacts');
  };

  const handleExportComplete = (result) => {
    setExportResult(result);
    setCurrentStep('complete');
  };

  const handleOutlookExport = async (selectedIds) => {
    // Load conversations if not already loaded
    if (conversations.length === 0) {
      const result = await window.electron.getConversations();
      if (result.success) {
        setConversations(result.conversations);
      }
    }
    setSelectedConversationIds(selectedIds);
    setCurrentStep('outlook');
  };

  const handleOutlookComplete = (result) => {
    // Only save to localStorage if export was successful
    if (result && result.exportPath) {
      const exportData = {
        contactIds: Array.from(selectedConversationIds),
        exportType: 'all'
      };

      console.log('Outlook export completed successfully, saving:', {
        count: exportData.contactIds.length,
        contactIds: exportData.contactIds,
        exportType: exportData.exportType
      });

      localStorage.setItem('lastExportedContacts', JSON.stringify(exportData));
    }

    setExportResult(result);
    setCurrentStep('complete');
  };

  const handleOutlookCancel = () => {
    setCurrentStep('contacts');
  };

  const handleStartOver = () => {
    setExportResult(null);
    setSelectedConversationIds(new Set()); // Clear selected conversations
    setCurrentStep('contacts');
  };

  const getPageTitle = () => {
    switch (currentStep) {
      case 'microsoft-login':
        return 'Login';
      case 'permissions':
        return 'Setup Permissions';
      case 'contacts':
        return 'Select Contacts for Export';
      case 'outlook':
        return 'Export to Outlook';
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
        {currentStep === 'microsoft-login' && (
          <MicrosoftLogin
            onLoginComplete={handleMicrosoftLogin}
            onSkip={handleMicrosoftSkip}
          />
        )}

        {currentStep === 'permissions' && (
          <PermissionsScreen
            onPermissionsGranted={handlePermissionsGranted}
            onCheckAgain={checkPermissions}
          />
        )}

        {currentStep === 'contacts' && (
          <ConversationList
            onExportComplete={handleExportComplete}
            onOutlookExport={handleOutlookExport}
            onConnectOutlook={handleConnectOutlook}
            outlookConnected={outlookConnected}
          />
        )}

        {currentStep === 'outlook' && (
          <OutlookExport
            conversations={conversations}
            selectedIds={selectedConversationIds}
            onComplete={handleOutlookComplete}
            onCancel={handleOutlookCancel}
          />
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
                <span className="font-mono font-semibold text-gray-900">1.0.7</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Update:</span>
                <span className="font-mono text-gray-700 bg-green-100 px-1 rounded">✨ Clean Filenames</span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-gray-500 text-xs">
                  MagicAudit
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Update Notification */}
      <UpdateNotification />

      {/* Move App Prompt */}
      {showMoveAppPrompt && (
        <MoveAppPrompt
          appPath={appPath}
          onDismiss={handleDismissMovePrompt}
          onNotNow={handleNotNowMovePrompt}
        />
      )}
    </div>
  );
}

export default App;
