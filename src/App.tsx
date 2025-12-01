import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import MicrosoftLogin from './components/MicrosoftLogin';
import EmailOnboardingScreen from './components/EmailOnboardingScreen';
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
import { useAuth } from './contexts';
import type { Conversation } from './hooks/useConversations';
import type { Subscription } from '../electron/types/models';

// Type definitions
type AppStep = 'login' | 'email-onboarding' | 'microsoft-login' | 'permissions' | 'dashboard' | 'outlook' | 'complete' | 'contacts';

interface AppExportResult {
  exportPath?: string;
  filesCreated?: string[];
  results?: Array<{
    contactName: string;
    success: boolean;
  }>;
}

interface OutlookExportResults {
  success: boolean;
  exportPath?: string;
  results?: Array<{
    contactName: string;
    success: boolean;
    textMessageCount: number;
    emailCount?: number;
    error: string | null;
  }>;
  error?: string;
  canceled?: boolean;
}

function App() {
  // Auth state from context
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    currentUser,
    sessionToken,
    authProvider,
    subscription,
    needsTermsAcceptance,
    login,
    logout,
    acceptTerms,
    declineTerms,
    clearTermsRequirement,
  } = useAuth();

  // Local UI state
  const [currentStep, setCurrentStep] = useState<AppStep>('login');
  const [hasPermissions, setHasPermissions] = useState<boolean>(false);
  const [outlookConnected, setOutlookConnected] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<AppExportResult | null>(null);
  const [showVersion, setShowVersion] = useState<boolean>(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set());
  const [showMoveAppPrompt, setShowMoveAppPrompt] = useState<boolean>(false);
  const [appPath, setAppPath] = useState<string>('');
  const [showProfile, setShowProfile] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showTransactions, setShowTransactions] = useState<boolean>(false);
  const [showContacts, setShowContacts] = useState<boolean>(false);
  const [showAuditTransaction, setShowAuditTransaction] = useState<boolean>(false);
  const [isTourActive, setIsTourActive] = useState<boolean>(false);
  const [hasCompletedEmailOnboarding, setHasCompletedEmailOnboarding] = useState<boolean>(true); // Default true to avoid flicker
  const [isCheckingEmailOnboarding, setIsCheckingEmailOnboarding] = useState<boolean>(true);
  const [hasEmailConnected, setHasEmailConnected] = useState<boolean>(true); // Default true to avoid flicker
  const [showSetupPromptDismissed, setShowSetupPromptDismissed] = useState<boolean>(false);

  // Check if user has completed email onboarding and has email connected
  useEffect(() => {
    const checkEmailStatus = async () => {
      if (currentUser?.id) {
        setIsCheckingEmailOnboarding(true);
        try {
          // Check onboarding status
          const onboardingResult = await window.api.auth.checkEmailOnboarding(currentUser.id);
          if (onboardingResult.success) {
            setHasCompletedEmailOnboarding(onboardingResult.completed);
          }

          // Check if any email is connected
          const connectionResult = await window.api.system.checkAllConnections(currentUser.id);
          if (connectionResult.success) {
            const hasConnection = connectionResult.google?.connected || connectionResult.microsoft?.connected;
            setHasEmailConnected(hasConnection);
          }
        } catch (error) {
          console.error('[App] Failed to check email status:', error);
        } finally {
          setIsCheckingEmailOnboarding(false);
        }
      }
    };
    checkEmailStatus();
  }, [currentUser?.id]);

  // Handle auth state changes to update navigation
  useEffect(() => {
    if (!isAuthLoading && !isCheckingEmailOnboarding) {
      if (isAuthenticated && !needsTermsAcceptance) {
        // User is authenticated and has accepted terms
        // Check if user needs email onboarding (hasn't completed it yet)
        if (!hasCompletedEmailOnboarding) {
          setCurrentStep('email-onboarding');
        } else if (hasPermissions) {
          setCurrentStep('dashboard');
        } else {
          setCurrentStep('permissions');
        }
      } else if (!isAuthenticated) {
        setCurrentStep('login');
      }
    }
  }, [isAuthenticated, isAuthLoading, needsTermsAcceptance, hasPermissions, hasCompletedEmailOnboarding, isCheckingEmailOnboarding]);

  useEffect(() => {
    checkPermissions();
    checkAppLocation();
  }, []);

  const handleLoginSuccess = (user: { id: string; email: string; display_name?: string; avatar_url?: string }, token: string, provider: string, subscriptionData: Subscription | undefined, isNewUser: boolean): void => {
    login(user, token, provider, subscriptionData, isNewUser);
  };

  const handleAcceptTerms = async (): Promise<void> => {
    try {
      await acceptTerms();
      // New user needs email onboarding - hasCompletedEmailOnboarding is already false
      // Navigation will be handled by the useEffect
    } catch (error) {
      console.error('[App] Failed to accept terms:', error);
    }
  };

  const handleDeclineTerms = async (): Promise<void> => {
    await declineTerms();
  };

  const handleLogout = async (): Promise<void> => {
    await logout();
    setShowProfile(false);
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
      console.error('[App] Error checking app location:', error);
    }
  };

  const handleDismissMovePrompt = () => {
    setShowMoveAppPrompt(false);
  };

  const handleNotNowMovePrompt = () => {
    setShowMoveAppPrompt(false);
  };

  const completeEmailOnboarding = async () => {
    // Mark email onboarding as completed in database
    if (currentUser?.id) {
      try {
        await window.api.auth.completeEmailOnboarding(currentUser.id);
        setHasCompletedEmailOnboarding(true);
      } catch (error) {
        console.error('[App] Failed to complete email onboarding:', error);
      }
    }
  };

  const handleEmailOnboardingComplete = async () => {
    await completeEmailOnboarding();
    // User connected email (Continue button only enabled when connected)
    setHasEmailConnected(true);
    // Navigate to permissions or dashboard
    if (hasPermissions) {
      setCurrentStep('dashboard');
    } else {
      setCurrentStep('permissions');
    }
  };

  const handleEmailOnboardingSkip = async () => {
    // Skipping also marks onboarding as complete so user doesn't see full screen again
    // Dashboard will show prompt based on whether email is actually connected
    await completeEmailOnboarding();
    // Navigate to permissions or dashboard
    if (hasPermissions) {
      setCurrentStep('dashboard');
    } else {
      setCurrentStep('permissions');
    }
  };

  const handleDismissSetupPrompt = () => {
    // User dismissed the setup prompt from dashboard - just hide it for this session
    setShowSetupPromptDismissed(true);
  };

  const handleMicrosoftLogin = (_userInfo: unknown) => {
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

  const handleExportComplete = (result: any) => {
    setExportResult(result as AppExportResult);
    setCurrentStep('complete');
  };

  const handleOutlookExport = async (selectedIds: Set<string>) => {
    // Load conversations if not already loaded
    if (conversations.length === 0) {
      const result = await window.electron.getConversations();
      if (result.success && result.conversations) {
        setConversations(result.conversations as Conversation[]);
      }
    }
    setSelectedConversationIds(selectedIds);
    setCurrentStep('outlook');
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
      case 'email-onboarding':
        return 'Connect Email';
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

        {currentStep === 'email-onboarding' && currentUser && authProvider && (
          <EmailOnboardingScreen
            userId={currentUser.id}
            authProvider={authProvider}
            onComplete={handleEmailOnboardingComplete}
            onSkip={handleEmailOnboardingSkip}
          />
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
            onTourStateChange={setIsTourActive}
            showSetupPrompt={!hasEmailConnected && !showSetupPromptDismissed}
            onContinueSetup={() => setCurrentStep('email-onboarding')}
            onDismissSetupPrompt={handleDismissSetupPrompt}
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
            onComplete={(results: OutlookExportResults | null) => {
              if (results) {
                setExportResult({
                  exportPath: results.exportPath,
                  results: results.results?.map(r => ({
                    contactName: r.contactName,
                    success: r.success
                  }))
                });
              } else {
                setExportResult(null);
              }
              setCurrentStep('complete');
            }}
            onCancel={handleOutlookCancel}
          />
        )}

        {currentStep === 'complete' && exportResult && (
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

      {/* System Health Monitor - Show permission/connection errors (hidden during onboarding tour and email onboarding) */}
      {/* Key forces re-mount when email connection status changes, triggering fresh health check */}
      {isAuthenticated && currentUser && authProvider && (
        <SystemHealthMonitor
          key={`health-monitor-${hasEmailConnected}`}
          userId={currentUser.id}
          provider={authProvider}
          hidden={isTourActive || currentStep === 'email-onboarding'}
        />
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
      {showProfile && currentUser && authProvider && (
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
      {showTransactions && currentUser && authProvider && (
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

      {/* Welcome Terms Modal (New Users Only) - casting user to component's User type */}
      {needsTermsAcceptance && currentUser && (
        <WelcomeTerms
          user={currentUser as any}
          onAccept={handleAcceptTerms}
          onDecline={handleDeclineTerms}
        />
      )}

      {/* Audit Transaction Modal */}
      {showAuditTransaction && currentUser && authProvider && (
        <AuditTransactionModal
          userId={currentUser.id as any}
          provider={authProvider}
          onClose={() => setShowAuditTransaction(false)}
          onSuccess={() => {
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
