import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import MicrosoftLogin from './components/MicrosoftLogin';
import PermissionsScreen from './components/PermissionsScreen';
import ConversationList from './components/ConversationList';
import ExportComplete from './components/ExportComplete';
import OutlookExport from './components/OutlookExport';
import UpdateNotification from './components/UpdateNotification';
import SystemHealthMonitor from './components/SystemHealthMonitor';
import MoveAppPrompt from './components/MoveAppPrompt';
import Profile from './components/Profile';
import Settings from './components/Settings';
import Transactions from './components/Transactions';
import Contacts from './components/Contacts';
import WelcomeTerms from './components/WelcomeTerms';
import Dashboard from './components/Dashboard';
import AuditTransactionModal from './components/AuditTransactionModal';

// Type definitions
type AppStep = 'login' | 'microsoft-login' | 'permissions' | 'dashboard' | 'outlook' | 'complete' | 'contacts';

interface User {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
}

interface Subscription {
  tier?: string;
  status?: string;
}

function App() {
  const [currentStep, setCurrentStep] = useState<AppStep>('login');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [hasPermissions, setHasPermissions] = useState<boolean>(false);
  const [outlookConnected, setOutlookConnected] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<any>(null);
  const [showVersion, setShowVersion] = useState<boolean>(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set());
  const [showMoveAppPrompt, setShowMoveAppPrompt] = useState<boolean>(false);
  const [appPath, setAppPath] = useState<string>('');
  const [showProfile, setShowProfile] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showTransactions, setShowTransactions] = useState<boolean>(false);
  const [showContacts, setShowContacts] = useState<boolean>(false);
  const [showWelcomeTerms, setShowWelcomeTerms] = useState<boolean>(false);
  const [showAuditTransaction, setShowAuditTransaction] = useState<boolean>(false);
  const [authProvider, setAuthProvider] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    checkSession();
    checkPermissions();
    checkAppLocation();
  }, []);

  const checkSession = async (): Promise<void> => {
    // Check if user has an existing session (now using persistent session service)
    if (window.api?.auth?.getCurrentUser) {
      try {
        const result = await window.api.auth.getCurrentUser();
        if (result.success) {
          console.log('Auto-login: Session found, logging in user');
          setIsAuthenticated(true);
          setCurrentUser(result.user);
          setSessionToken(result.sessionToken);
          setAuthProvider(result.provider);
          setSubscription(result.subscription);
          // Also store in localStorage for backward compatibility
          localStorage.setItem('sessionToken', result.sessionToken);

          // Check if user needs to accept terms (for new users or version updates)
          if (result.isNewUser) {
            setShowWelcomeTerms(true);
          } else {
            // Skip to permissions or dashboard based on permission status
            if (hasPermissions) {
              setCurrentStep('dashboard');
            } else {
              setCurrentStep('permissions');
            }
          }
        } else {
          console.log('Auto-login: No active session found');
          // Clear any stale localStorage data
          localStorage.removeItem('sessionToken');
        }
      } catch (error) {
        console.error('Session check failed:', error);
        localStorage.removeItem('sessionToken');
      }
    }
  };

  const handleLoginSuccess = (user: User, token: string, provider: string, subscription: Subscription, isNewUser: boolean): void => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    setSessionToken(token);
    setAuthProvider(provider);
    setSubscription(subscription);
    localStorage.setItem('sessionToken', token);

    // Show welcome modal for new users
    if (isNewUser) {
      setShowWelcomeTerms(true);
    } else {
      // Proceed to permissions check for existing users
      if (hasPermissions) {
        setCurrentStep('dashboard');
      } else {
        setCurrentStep('permissions');
      }
    }
  };

  const handleAcceptTerms = async (): Promise<void> => {
    try {
      if (currentUser && window.api?.auth?.acceptTerms) {
        await window.api.auth.acceptTerms(currentUser.id);
        setShowWelcomeTerms(false);

        // Proceed to app after accepting terms
        if (hasPermissions) {
          setCurrentStep('dashboard');
        } else {
          setCurrentStep('permissions');
        }
      }
    } catch (error) {
      console.error('Failed to accept terms:', error);
    }
  };

  const handleDeclineTerms = async (): Promise<void> => {
    // User declined terms, log them out
    await handleLogout();
  };

  const handleLogout = async (): Promise<void> => {
    if (sessionToken && window.api?.auth?.logout) {
      try {
        await window.api.auth.logout(sessionToken);
      } catch (error) {
        console.error('Logout failed:', error);
      }
    }

    // Clear all state
    setIsAuthenticated(false);
    setCurrentUser(null);
    setSessionToken(null);
    setAuthProvider(null);
    setSubscription(null);
    setShowProfile(false);
    setShowWelcomeTerms(false);
    localStorage.removeItem('sessionToken');
    setCurrentStep('login');
  };

  const checkPermissions = async (): Promise<void> => {
    const result = await window.electron.checkPermissions();
    if (result.hasPermission) {
      setHasPermissions(true);
    }
  };

  const checkAppLocation = async (): Promise<void> => {
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
      setCurrentStep('dashboard');
    } else {
      setCurrentStep('permissions');
    }
  };

  const handleMicrosoftSkip = () => {
    setOutlookConnected(false);
    // Check if we already have permissions
    if (hasPermissions) {
      setCurrentStep('dashboard');
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
    setCurrentStep('dashboard');
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
    setExportResult(result);
    setCurrentStep('complete');
  };

  const handleOutlookCancel = () => {
    setCurrentStep('dashboard');
  };

  const handleStartOver = () => {
    setExportResult(null);
    setSelectedConversationIds(new Set()); // Clear selected conversations
    setCurrentStep('dashboard');
  };

  const getPageTitle = (): string => {
    switch (currentStep) {
      case 'login':
        return 'Welcome';
      case 'microsoft-login':
        return 'Login';
      case 'permissions':
        return 'Setup Permissions';
      case 'dashboard':
        return 'Dashboard';
      case 'contacts':
        return 'Select Contacts for Export';
      case 'outlook':
        return 'Export to Outlook';
      case 'complete':
        return 'Export Complete';
      default:
        return 'Magic Audit';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Title Bar - Hide on login screen */}
      {currentStep !== 'login' && (
        <div className="flex-shrink-0 bg-gradient-to-b from-gray-100 to-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between select-none">
          <div className="w-8" /> {/* Spacer for centering */}
          <h1 className="text-sm font-semibold text-gray-700">{getPageTitle()}</h1>
          {/* User Menu Button */}
          {isAuthenticated && currentUser && (
            <button
              onClick={() => setShowProfile(true)}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-md transition-all hover:shadow-lg"
              title={`${currentUser.display_name || currentUser.email} - Click for account settings`}
              data-tour="profile-button"
            >
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt="Profile" className="w-8 h-8 rounded-full" />
              ) : (
                currentUser.display_name?.[0]?.toUpperCase() || currentUser.email?.[0]?.toUpperCase() || '?'
              )}
            </button>
          )}
        </div>
      )}

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto relative">
        {currentStep === 'login' && (
          <Login onLoginSuccess={handleLoginSuccess} />
        )}

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

        {currentStep === 'dashboard' && (
          <Dashboard
            onAuditNew={() => setShowAuditTransaction(true)}
            onViewTransactions={() => setShowTransactions(true)}
            onManageContacts={() => setShowContacts(true)}
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

      {/* System Health Monitor - Show permission/connection errors */}
      {isAuthenticated && currentUser && (
        <SystemHealthMonitor userId={currentUser.id} provider={authProvider} />
      )}

      {/* Move App Prompt */}
      {showMoveAppPrompt && (
        <MoveAppPrompt
          appPath={appPath}
          onDismiss={handleDismissMovePrompt}
          onNotNow={handleNotNowMovePrompt}
        />
      )}

      {/* Profile Modal */}
      {showProfile && currentUser && (
        <Profile
          user={currentUser}
          provider={authProvider}
          subscription={subscription}
          onLogout={handleLogout}
          onClose={() => setShowProfile(false)}
          onViewTransactions={() => setShowTransactions(true)}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && currentUser && (
        <Settings
          userId={currentUser.id}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Transactions View */}
      {showTransactions && currentUser && (
        <Transactions
          userId={currentUser.id}
          provider={authProvider}
          onClose={() => setShowTransactions(false)}
        />
      )}

      {/* Contacts View */}
      {showContacts && currentUser && (
        <Contacts
          userId={currentUser.id}
          onClose={() => setShowContacts(false)}
        />
      )}

      {/* Welcome Terms Modal (New Users Only) */}
      {showWelcomeTerms && currentUser && (
        <WelcomeTerms
          user={currentUser}
          onAccept={handleAcceptTerms}
          onDecline={handleDeclineTerms}
        />
      )}

      {/* Audit Transaction Modal */}
      {showAuditTransaction && currentUser && (
        <AuditTransactionModal
          userId={currentUser.id}
          provider={authProvider}
          onClose={() => setShowAuditTransaction(false)}
          onSuccess={(newTransaction) => {
            setShowAuditTransaction(false);
            // Optionally show the transactions view after successful creation
            setShowTransactions(true);
          }}
        />
      )}
    </div>
  );
}

export default App;
