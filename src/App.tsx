import React, { useState, useEffect, useCallback } from 'react';
import Login, { PendingOAuthData } from './components/Login';
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
import SecureStorageSetup from './components/SecureStorageSetup';
import KeychainExplanation from './components/KeychainExplanation';
import Dashboard from './components/Dashboard';
import AuditTransactionModal from './components/AuditTransactionModal';
import OfflineFallback from './components/OfflineFallback';
import { useAuth, useNetwork } from './contexts';
import type { Conversation } from './hooks/useConversations';
import type { Subscription } from '../electron/types/models';

// Type definitions
type AppStep = 'loading' | 'login' | 'secure-storage-setup' | 'keychain-explanation' | 'email-onboarding' | 'microsoft-login' | 'permissions' | 'dashboard' | 'outlook' | 'complete' | 'contacts';

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

  // Network state from context
  const { isOnline, isChecking, connectionError, checkConnection, setConnectionError } = useNetwork();

  // Local UI state
  const [currentStep, setCurrentStep] = useState<AppStep>('loading');
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
  const [hasSecureStorageSetup, setHasSecureStorageSetup] = useState<boolean>(true); // Default true for returning users
  const [isCheckingSecureStorage, setIsCheckingSecureStorage] = useState<boolean>(true);
  const [isNewUserFlow, setIsNewUserFlow] = useState<boolean>(false); // Track if this is a new user flow
  const [isDatabaseInitialized, setIsDatabaseInitialized] = useState<boolean>(false); // Track if database is ready
  const [isInitializingDatabase, setIsInitializingDatabase] = useState<boolean>(false); // Track initialization in progress
  const [skipKeychainExplanation, setSkipKeychainExplanation] = useState<boolean>(() => {
    // Check localStorage for user preference
    return localStorage.getItem('skipKeychainExplanation') === 'true';
  });
  const [pendingOAuthData, setPendingOAuthData] = useState<PendingOAuthData | null>(null); // OAuth data waiting for keychain setup

  // Check if encryption key store exists on app load
  // This is a file existence check that does NOT trigger keychain prompts
  // Used to determine if this is a new user (no key store) vs returning user (has key store)
  useEffect(() => {
    const checkKeyStoreExists = async () => {
      setIsCheckingSecureStorage(true);
      try {
        const result = await window.api.system.hasEncryptionKeyStore();
        // If key store exists, user has already set up secure storage before
        setHasSecureStorageSetup(result.hasKeyStore);
      } catch (error) {
        console.error('[App] Failed to check key store existence:', error);
        // Assume not set up if check fails (will show setup screen for safety)
        setHasSecureStorageSetup(false);
      } finally {
        setIsCheckingSecureStorage(false);
      }
    };
    checkKeyStoreExists();
  }, []);

  // NOTE: We removed the auto-initialization for returning users.
  // The keychain prompt should NEVER appear before the user logs in.
  // Flow: Login → Keychain explanation screen → User clicks Continue → Keychain prompt
  // The "skip explanation" preference only skips the detailed explanation, not the screen itself.

  // Check if user has completed email onboarding and has email connected
  useEffect(() => {
    const checkEmailStatus = async () => {
      if (currentUser?.id) {
        setIsCheckingEmailOnboarding(true);
        try {
          // Check onboarding status
          // Type assertion needed as preload API types are inferred from electron
          const authApi = window.api.auth as typeof window.api.auth & {
            checkEmailOnboarding: (userId: string) => Promise<{ success: boolean; completed: boolean; error?: string }>;
          };
          const onboardingResult = await authApi.checkEmailOnboarding(currentUser.id);
          if (onboardingResult.success) {
            setHasCompletedEmailOnboarding(onboardingResult.completed);
          }

          // Check if any email is connected
          const connectionResult = await window.api.system.checkAllConnections(currentUser.id);
          if (connectionResult.success) {
            const hasConnection = connectionResult.google?.connected === true || connectionResult.microsoft?.connected === true;
            setHasEmailConnected(hasConnection);
          }
        } catch (error) {
          console.error('[App] Failed to check email status:', error);
        } finally {
          setIsCheckingEmailOnboarding(false);
        }
      } else {
        // No user logged in, nothing to check
        setIsCheckingEmailOnboarding(false);
      }
    };
    checkEmailStatus();
  }, [currentUser?.id]);

  // Handle auth state changes to update navigation
  // FLOW: Login FIRST, then keychain setup if needed (for both new and returning users)
  useEffect(() => {
    if (!isAuthLoading && !isCheckingEmailOnboarding && !isCheckingSecureStorage) {
      // If we have pending OAuth data, we're in the middle of the login-first flow
      // Show keychain explanation/setup screen (OAuth succeeded, need keychain to save data)
      if (pendingOAuthData && !isAuthenticated) {
        // Show keychain explanation screen - OAuth data is in memory waiting
        setCurrentStep('keychain-explanation');
        return;
      }

      if (isAuthenticated && !needsTermsAcceptance) {
        // User is authenticated and has accepted terms
        if (!hasCompletedEmailOnboarding) {
          setCurrentStep('email-onboarding');
        } else if (hasPermissions) {
          setCurrentStep('dashboard');
        } else {
          setCurrentStep('permissions');
        }
      } else if (!isAuthenticated) {
        // Not authenticated - show login FIRST for both new and returning users
        // After OAuth succeeds, if DB isn't initialized, auth-handlers will send
        // login-pending event and we'll show keychain explanation with pendingOAuthData
        setCurrentStep('login');
      }
    }
  }, [isAuthenticated, isAuthLoading, needsTermsAcceptance, hasPermissions, hasCompletedEmailOnboarding, isCheckingEmailOnboarding, isCheckingSecureStorage, pendingOAuthData]);

  useEffect(() => {
    checkPermissions();
    checkAppLocation();
  }, []);

  const handleLoginSuccess = (user: { id: string; email: string; display_name?: string; avatar_url?: string }, token: string, provider: string, subscriptionData: Subscription | undefined, isNewUser: boolean): void => {
    // Track if this is a new user flow for secure storage setup
    setIsNewUserFlow(isNewUser);
    // Clear any pending OAuth data since login completed successfully
    setPendingOAuthData(null);
    login(user, token, provider, subscriptionData, isNewUser);
  };

  // Handle pending login - OAuth succeeded but database not initialized
  // Store the OAuth data and show keychain explanation screen
  const handleLoginPending = (oauthData: PendingOAuthData): void => {
    setPendingOAuthData(oauthData);
    // Navigation will be handled by useEffect - will show keychain-explanation
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
    setIsNewUserFlow(false);
    setCurrentStep('login');
  };

  const handleSecureStorageComplete = () => {
    // Mark secure storage as set up and database as initialized
    // Note: Database is now initialized inside initializeSecureStorage handler
    // to consolidate keychain prompts into a single operation
    setHasSecureStorageSetup(true);
    setIsDatabaseInitialized(true);
    // Navigation will be handled by useEffect - will go to login (new flow) or email-onboarding
  };

  // Handler for keychain explanation screen
  // This is shown in two scenarios:
  // 1. Returning user: Before login, to authorize keychain access
  // 2. Login-first flow: After OAuth succeeded but before DB was initialized
  const handleKeychainExplanationContinue = async (dontShowAgain: boolean) => {
    // Save preference if user checked "don't show again"
    if (dontShowAgain) {
      localStorage.setItem('skipKeychainExplanation', 'true');
      setSkipKeychainExplanation(true);
    }

    // Initialize database (triggers keychain prompt)
    setIsInitializingDatabase(true);
    try {
      const result = await window.api.system.initializeSecureStorage();
      if (result.success) {
        setIsDatabaseInitialized(true);
        setHasSecureStorageSetup(true);

        // If we have pending OAuth data, complete the login now
        if (pendingOAuthData) {
          try {
            const loginResult = await window.api.auth.completePendingLogin(pendingOAuthData);
            if (loginResult.success && loginResult.user && loginResult.sessionToken) {
              // The subscription is already a full Subscription object from supabaseService.validateSubscription()
              const subscriptionData = loginResult.subscription as Subscription | undefined;
              // Convert User type (terms_accepted_at may be Date or string from API)
              const user = loginResult.user as { id: string; email: string; display_name?: string; avatar_url?: string };

              // Call the auth context login
              setIsNewUserFlow(loginResult.isNewUser || false);
              setPendingOAuthData(null);
              login(user, loginResult.sessionToken, pendingOAuthData.provider, subscriptionData, loginResult.isNewUser || false);
            } else {
              console.error('[App] Failed to complete pending login:', loginResult.error);
              setPendingOAuthData(null);
              // Navigation will show login screen again
            }
          } catch (error) {
            console.error('[App] Error completing pending login:', error);
            setPendingOAuthData(null);
          }
        }
        // If no pending OAuth data, navigation will show login screen
      } else {
        console.error('[App] Database initialization failed:', result.error);
        // Show error state - user can retry
      }
    } catch (error) {
      console.error('[App] Database initialization error:', error);
    } finally {
      setIsInitializingDatabase(false);
    }
  };

  const handleSecureStorageRetry = () => {
    // Re-check if key store exists (triggers a fresh check after user may have authorized keychain)
    setIsCheckingSecureStorage(true);
    window.api.system.hasEncryptionKeyStore()
      .then((result) => {
        setHasSecureStorageSetup(result.hasKeyStore);
      })
      .catch((error) => {
        console.error('[App] Failed to re-check key store existence:', error);
        setHasSecureStorageSetup(false);
      })
      .finally(() => {
        setIsCheckingSecureStorage(false);
      });
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
        // Type assertion needed as preload API types are inferred from electron
        const authApi = window.api.auth as typeof window.api.auth & {
          completeEmailOnboarding: (userId: string) => Promise<{ success: boolean; error?: string }>;
        };
        await authApi.completeEmailOnboarding(currentUser.id);
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

  // Handle retry when offline
  const handleRetryConnection = useCallback(async () => {
    const online = await checkConnection();
    if (!online) {
      setConnectionError('Unable to connect. Please check your internet connection.');
    }
  }, [checkConnection, setConnectionError]);

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
      case 'secure-storage-setup':
        return 'Secure Storage';
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

      {/* Offline Banner - Show when network is unavailable */}
      {!isOnline && currentStep !== 'login' && (
        <div className="flex-shrink-0 bg-yellow-50 border-b border-yellow-200 px-4 py-3">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="w-5 h-5 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  You're offline
                </p>
                <p className="text-xs text-yellow-700">
                  Some features may be limited. Your local data is still accessible.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRetryConnection}
                disabled={isChecking}
                className="px-3 py-1.5 text-xs font-medium text-yellow-800 bg-yellow-200 hover:bg-yellow-300 rounded-md transition-colors disabled:opacity-50"
              >
                {isChecking ? 'Checking...' : 'Retry'}
              </button>
              <button
                onClick={() => window.api?.system?.contactSupport?.('Network connection issue')}
                className="px-3 py-1.5 text-xs font-medium text-yellow-800 hover:text-yellow-900 transition-colors"
              >
                Get Help
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Loading state - shown while determining which screen to display */}
        {currentStep === 'loading' && (
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">Starting Magic Audit...</p>
            </div>
          </div>
        )}

        {/* Show full offline screen during login when network is unavailable */}
        {currentStep === 'login' && !isOnline ? (
          <OfflineFallback
            isOffline={true}
            isRetrying={isChecking}
            error={connectionError}
            onRetry={handleRetryConnection}
            mode="fullscreen"
          />
        ) : currentStep === 'login' ? (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onLoginPending={handleLoginPending}
          />
        ) : null}

        {currentStep === 'secure-storage-setup' && (
          <SecureStorageSetup
            onComplete={handleSecureStorageComplete}
            onRetry={handleSecureStorageRetry}
          />
        )}

        {currentStep === 'keychain-explanation' && (
          <KeychainExplanation
            onContinue={handleKeychainExplanationContinue}
            isLoading={isInitializingDatabase}
            hasPendingLogin={!!pendingOAuthData}
            skipExplanation={skipKeychainExplanation}
          />
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

      {/* System Health Monitor - Show permission/connection errors (only on dashboard after permissions granted) */}
      {/* Key forces re-mount when email connection status changes, triggering fresh health check */}
      {/* IMPORTANT: Don't run health checks until user has completed permissions setup, otherwise
          it tries to access contacts database before Full Disk Access is granted */}
      {isAuthenticated && currentUser && authProvider && hasPermissions && currentStep === 'dashboard' && (
        <SystemHealthMonitor
          key={`health-monitor-${hasEmailConnected}`}
          userId={currentUser.id}
          provider={authProvider}
          hidden={isTourActive || needsTermsAcceptance}
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
