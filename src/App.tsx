import React, { useState, useEffect, useCallback } from "react";
import Login, { PendingOAuthData } from "./components/Login";
import MicrosoftLogin from "./components/MicrosoftLogin";
import EmailOnboardingScreen from "./components/EmailOnboardingScreen";
import PermissionsScreen from "./components/PermissionsScreen";
import ConversationList from "./components/ConversationList";
import ExportComplete from "./components/ExportComplete";
import OutlookExport from "./components/OutlookExport";
import UpdateNotification from "./components/UpdateNotification";
import SystemHealthMonitor from "./components/SystemHealthMonitor";
import MoveAppPrompt from "./components/MoveAppPrompt";
import Profile from "./components/Profile";
import Settings from "./components/Settings";
import Transactions from "./components/Transactions";
import Contacts from "./components/Contacts";
import WelcomeTerms from "./components/WelcomeTerms";
import KeychainExplanation from "./components/KeychainExplanation";
import Dashboard from "./components/Dashboard";
import AuditTransactionModal from "./components/AuditTransactionModal";
import OfflineFallback from "./components/OfflineFallback";
import PhoneTypeSelection from "./components/PhoneTypeSelection";
import AndroidComingSoon from "./components/AndroidComingSoon";
import AppleDriverSetup from "./components/AppleDriverSetup";
import { useAuth, useNetwork, usePlatform } from "./contexts";
import type { Conversation } from "./hooks/useConversations";
import type { Subscription } from "../electron/types/models";

// Type definitions
type AppStep =
  | "loading"
  | "login"
  | "keychain-explanation"
  | "phone-type-selection"
  | "android-coming-soon"
  | "apple-driver-setup"
  | "email-onboarding"
  | "microsoft-login"
  | "permissions"
  | "dashboard"
  | "outlook"
  | "complete"
  | "contacts";

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

// Pending onboarding data - stored in memory before DB is initialized
interface PendingOnboardingData {
  termsAccepted: boolean;
  phoneType: "iphone" | "android" | null;
  emailConnected: boolean;
  emailProvider: "google" | "microsoft" | null;
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
  const {
    isOnline,
    isChecking,
    connectionError,
    checkConnection,
    setConnectionError,
  } = useNetwork();

  // Platform detection
  const { isMacOS, isWindows } = usePlatform();

  // Local UI state
  const [currentStep, setCurrentStep] = useState<AppStep>("loading");
  const [hasPermissions, setHasPermissions] = useState<boolean>(false);
  const [outlookConnected, setOutlookConnected] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<AppExportResult | null>(
    null,
  );
  const [showVersion, setShowVersion] = useState<boolean>(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationIds, setSelectedConversationIds] = useState<
    Set<string>
  >(new Set());
  const [showMoveAppPrompt, setShowMoveAppPrompt] = useState<boolean>(false);
  const [appPath, setAppPath] = useState<string>("");
  const [showProfile, setShowProfile] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showTransactions, setShowTransactions] = useState<boolean>(false);
  const [showContacts, setShowContacts] = useState<boolean>(false);
  const [showAuditTransaction, setShowAuditTransaction] =
    useState<boolean>(false);
  const [isTourActive, setIsTourActive] = useState<boolean>(false);
  const [hasCompletedEmailOnboarding, setHasCompletedEmailOnboarding] =
    useState<boolean>(true); // Default true to avoid flicker
  const [isCheckingEmailOnboarding, setIsCheckingEmailOnboarding] =
    useState<boolean>(true);
  const [hasEmailConnected, setHasEmailConnected] = useState<boolean>(true); // Default true to avoid flicker
  const [showSetupPromptDismissed, setShowSetupPromptDismissed] =
    useState<boolean>(false);
  const [hasSecureStorageSetup, setHasSecureStorageSetup] =
    useState<boolean>(true); // Default true for returning users
  const [isCheckingSecureStorage, setIsCheckingSecureStorage] =
    useState<boolean>(true);
  const [isNewUserFlow, setIsNewUserFlow] = useState<boolean>(false); // Track if this is a new user flow
  const [isDatabaseInitialized, setIsDatabaseInitialized] =
    useState<boolean>(false); // Track if database is ready
  const [isInitializingDatabase, setIsInitializingDatabase] =
    useState<boolean>(false); // Track initialization in progress
  const [hasSelectedPhoneType, setHasSelectedPhoneType] =
    useState<boolean>(false);
  const [selectedPhoneType, setSelectedPhoneType] = useState<
    "iphone" | "android" | null
  >(null);
  const [isLoadingPhoneType, setIsLoadingPhoneType] = useState<boolean>(true);
  const [needsDriverSetup, setNeedsDriverSetup] = useState<boolean>(false); // Track if Windows + iPhone needs driver setup
  const [skipKeychainExplanation, setSkipKeychainExplanation] =
    useState<boolean>(() => {
      // Check localStorage for user preference
      return localStorage.getItem("skipKeychainExplanation") === "true";
    });
  const [pendingOAuthData, setPendingOAuthData] =
    useState<PendingOAuthData | null>(null); // OAuth data waiting for keychain setup
  const [pendingOnboardingData, setPendingOnboardingData] =
    useState<PendingOnboardingData>({
      termsAccepted: false,
      phoneType: null,
      emailConnected: false,
      emailProvider: null,
    }); // Onboarding data collected before DB init
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false); // Show terms during pre-DB onboarding

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

        // Windows: Initialize database immediately on startup (DPAPI doesn't require user interaction)
        // This ensures database tables exist before AuthContext tries to load sessions
        if (isWindows && result.hasKeyStore) {
          try {
            await window.api.system.initializeSecureStorage();
            setIsDatabaseInitialized(true);
          } catch (dbError) {
            console.error(
              "[App] Failed to initialize Windows database on startup:",
              dbError,
            );
          }
        }
      } catch (error) {
        console.error("[App] Failed to check key store existence:", error);
        // Assume not set up if check fails (will show setup screen for safety)
        setHasSecureStorageSetup(false);
      } finally {
        setIsCheckingSecureStorage(false);
      }
    };
    checkKeyStoreExists();
  }, [isWindows]);

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
            checkEmailOnboarding: (userId: string) => Promise<{
              success: boolean;
              completed: boolean;
              error?: string;
            }>;
          };
          const onboardingResult = await authApi.checkEmailOnboarding(
            currentUser.id,
          );
          if (onboardingResult.success) {
            setHasCompletedEmailOnboarding(onboardingResult.completed);
          }

          // Check if any email is connected
          const connectionResult = await window.api.system.checkAllConnections(
            currentUser.id,
          );
          if (connectionResult.success) {
            const hasConnection =
              connectionResult.google?.connected === true ||
              connectionResult.microsoft?.connected === true;
            setHasEmailConnected(hasConnection);
          }
        } catch (error) {
          console.error("[App] Failed to check email status:", error);
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

  // Load user's phone type from database when user logs in
  useEffect(() => {
    const loadPhoneType = async () => {
      if (currentUser?.id) {
        setIsLoadingPhoneType(true);
        try {
          // Type assertion for the user API
          const userApi = window.api.user as {
            getPhoneType: (userId: string) => Promise<{
              success: boolean;
              phoneType: "iphone" | "android" | null;
              error?: string;
            }>;
          };
          const result = await userApi.getPhoneType(currentUser.id);
          if (result.success && result.phoneType) {
            setSelectedPhoneType(result.phoneType);

            // On Windows + iPhone, check if drivers need to be installed/updated
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const drivers = (window.electron as any)?.drivers;
            if (isWindows && result.phoneType === "iphone" && drivers) {
              try {
                const driverStatus = await drivers.checkApple();
                if (!driverStatus.installed || !driverStatus.serviceRunning) {
                  // Drivers not installed or service not running - need setup
                  setNeedsDriverSetup(true);
                  setHasSelectedPhoneType(false); // Don't skip driver setup
                } else {
                  // Drivers are good
                  setNeedsDriverSetup(false);
                  setHasSelectedPhoneType(true);
                }
              } catch (driverError) {
                console.error(
                  "[App] Failed to check driver status:",
                  driverError,
                );
                // On error, assume drivers need setup
                setNeedsDriverSetup(true);
                setHasSelectedPhoneType(false);
              }
            } else {
              // Not Windows + iPhone, no driver check needed
              setNeedsDriverSetup(false);
              setHasSelectedPhoneType(true);
            }
          } else {
            // No phone type stored - user needs to select
            setHasSelectedPhoneType(false);
            setSelectedPhoneType(null);
            setNeedsDriverSetup(false);
          }
        } catch (error) {
          console.error("[App] Failed to load phone type:", error);
          // On error, assume not selected so user can choose
          setHasSelectedPhoneType(false);
          setSelectedPhoneType(null);
          setNeedsDriverSetup(false);
        } finally {
          setIsLoadingPhoneType(false);
        }
      } else {
        // No user logged in
        setIsLoadingPhoneType(false);
        setHasSelectedPhoneType(false);
        setSelectedPhoneType(null);
        setNeedsDriverSetup(false);
      }
    };
    loadPhoneType();
  }, [currentUser?.id, isWindows]);

  // Handle Windows database initialization without keychain prompt
  // Windows uses DPAPI (Data Protection API) which doesn't require user interaction
  // Wait until all pre-DB onboarding steps are complete (phone + email)
  useEffect(() => {
    const initializeWindowsDatabase = async () => {
      // Only initialize after pre-DB onboarding is complete (phone type selected and email step done)
      const preDbOnboardingComplete =
        pendingOnboardingData.phoneType !== null &&
        pendingOnboardingData.emailConnected;

      if (
        isWindows &&
        pendingOAuthData &&
        !isAuthenticated &&
        !isInitializingDatabase &&
        preDbOnboardingComplete
      ) {
        setIsInitializingDatabase(true);
        try {
          const result = await window.api.system.initializeSecureStorage();
          if (result.success) {
            setIsDatabaseInitialized(true);
            setHasSecureStorageSetup(true);

            // Complete login with pending OAuth data
            try {
              const loginResult =
                await window.api.auth.completePendingLogin(pendingOAuthData);
              if (
                loginResult.success &&
                loginResult.user &&
                loginResult.sessionToken
              ) {
                const subscriptionData = loginResult.subscription as
                  | Subscription
                  | undefined;
                const user = loginResult.user as {
                  id: string;
                  email: string;
                  display_name?: string;
                  avatar_url?: string;
                };

                // Persist pending onboarding data now that DB is initialized
                const userId = loginResult.user.id;

                // Save phone type
                if (pendingOnboardingData.phoneType) {
                  try {
                    const userApi = window.api.user as {
                      setPhoneType: (
                        userId: string,
                        phoneType: "iphone" | "android",
                      ) => Promise<{ success: boolean; error?: string }>;
                    };
                    await userApi.setPhoneType(userId, pendingOnboardingData.phoneType);
                    setHasSelectedPhoneType(true);

                    // Check if Windows + iPhone needs driver setup
                    if (pendingOnboardingData.phoneType === "iphone") {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const drivers = (window.electron as any)?.drivers;
                      if (drivers) {
                        try {
                          const driverStatus = await drivers.checkApple();
                          if (!driverStatus.installed || !driverStatus.serviceRunning) {
                            setNeedsDriverSetup(true);
                          }
                        } catch (driverError) {
                          console.error("[App] Failed to check driver status:", driverError);
                          setNeedsDriverSetup(true);
                        }
                      }
                    }
                  } catch (phoneError) {
                    console.error("[App] Failed to persist phone type:", phoneError);
                  }
                }

                // Mark email onboarding as complete
                if (pendingOnboardingData.emailConnected) {
                  try {
                    const authApi = window.api.auth as typeof window.api.auth & {
                      completeEmailOnboarding: (
                        userId: string,
                      ) => Promise<{ success: boolean; error?: string }>;
                    };
                    await authApi.completeEmailOnboarding(userId);
                    setHasCompletedEmailOnboarding(true);
                    setHasEmailConnected(pendingOnboardingData.emailProvider !== null);
                  } catch (emailError) {
                    console.error("[App] Failed to persist email onboarding:", emailError);
                  }
                }

                // Clear pending onboarding data
                setPendingOnboardingData({
                  termsAccepted: false,
                  phoneType: null,
                  emailConnected: false,
                  emailProvider: null,
                });

                setIsNewUserFlow(loginResult.isNewUser || false);
                login(
                  user,
                  loginResult.sessionToken,
                  pendingOAuthData.provider,
                  subscriptionData,
                  loginResult.isNewUser || false,
                );
                setPendingOAuthData(null);
              }
            } catch (loginError) {
              console.error(
                "[App] Failed to complete pending login:",
                loginError,
              );
            }
          }
        } catch (error) {
          console.error("[App] Failed to initialize Windows database:", error);
        } finally {
          setIsInitializingDatabase(false);
        }
      }
    };
    initializeWindowsDatabase();
  }, [
    isWindows,
    pendingOAuthData,
    pendingOnboardingData,
    isAuthenticated,
    isInitializingDatabase,
    login,
  ]);

  // Handle auth state changes to update navigation
  // NEW FLOW: Login → Terms → Phone → Email → Keychain/DB → Permissions → Dashboard
  useEffect(() => {
    if (
      !isAuthLoading &&
      !isCheckingSecureStorage
    ) {
      // PRE-DB FLOW: OAuth succeeded but database not initialized yet
      // Collect onboarding data in memory, then initialize DB at the end
      if (pendingOAuthData && !isAuthenticated) {
        const isNewUser = !pendingOAuthData.cloudUser.terms_accepted_at;

        // Step 1: New users must accept terms first (shows as modal)
        if (isNewUser && !pendingOnboardingData.termsAccepted) {
          setShowTermsModal(true);
          setCurrentStep("phone-type-selection"); // Show phone selection behind the modal
          return;
        }

        // Step 2: Phone type selection (stored in memory)
        if (!pendingOnboardingData.phoneType) {
          setShowTermsModal(false);
          setCurrentStep("phone-type-selection");
          return;
        }

        // Step 3: Email onboarding (stored in memory)
        if (!pendingOnboardingData.emailConnected) {
          setCurrentStep("email-onboarding");
          return;
        }

        // Step 4: All pre-DB onboarding complete - now initialize database
        // macOS: Show keychain explanation screen
        // Windows: Auto-initialize database (handled by separate useEffect)
        if (isMacOS) {
          setCurrentStep("keychain-explanation");
        }
        return;
      }

      // POST-DB FLOW: Database initialized, user authenticated
      if (isAuthenticated && !needsTermsAcceptance) {
        // Check if returning user needs to complete any onboarding steps
        // (These checks require DB access, so only run post-authentication)
        if (!isCheckingEmailOnboarding && !isLoadingPhoneType) {
          if (!hasSelectedPhoneType && !needsDriverSetup) {
            setCurrentStep("phone-type-selection");
          } else if (needsDriverSetup && isWindows) {
            setCurrentStep("apple-driver-setup");
          } else if (!hasCompletedEmailOnboarding || !hasEmailConnected) {
            setCurrentStep("email-onboarding");
          } else if (hasPermissions) {
            setCurrentStep("dashboard");
          } else {
            setCurrentStep("permissions");
          }
        }
      } else if (!isAuthenticated && !pendingOAuthData) {
        // Not authenticated and no pending OAuth - show login
        setCurrentStep("login");
      }
    }
  }, [
    isAuthenticated,
    isAuthLoading,
    needsTermsAcceptance,
    hasPermissions,
    hasCompletedEmailOnboarding,
    hasEmailConnected,
    isCheckingEmailOnboarding,
    isCheckingSecureStorage,
    pendingOAuthData,
    pendingOnboardingData,
    hasSelectedPhoneType,
    isLoadingPhoneType,
    needsDriverSetup,
    isWindows,
    isMacOS,
  ]);

  useEffect(() => {
    checkPermissions();
    checkAppLocation();
  }, []);

  // Windows: Skip permissions screen automatically (Full Disk Access not needed)
  useEffect(() => {
    if (isWindows && currentStep === "permissions") {
      setCurrentStep("dashboard");
    }
  }, [isWindows, currentStep]);

  const handleLoginSuccess = (
    user: {
      id: string;
      email: string;
      display_name?: string;
      avatar_url?: string;
    },
    token: string,
    provider: string,
    subscriptionData: Subscription | undefined,
    isNewUser: boolean,
  ): void => {
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

  // Handle terms acceptance - works in both pre-DB and post-DB flows
  const handleAcceptTerms = async (): Promise<void> => {
    try {
      // PRE-DB FLOW: Save to Supabase directly, store acceptance in memory
      if (pendingOAuthData && !isAuthenticated) {
        // Save terms acceptance to Supabase (cloud) directly
        const authApi = window.api.auth as typeof window.api.auth & {
          acceptTermsToSupabase: (userId: string) => Promise<{
            success: boolean;
            error?: string;
          }>;
        };
        const result = await authApi.acceptTermsToSupabase(
          pendingOAuthData.cloudUser.id,
        );
        if (result.success) {
          // Update pending onboarding data
          setPendingOnboardingData((prev: PendingOnboardingData) => ({ ...prev, termsAccepted: true }));
          setShowTermsModal(false);
        } else {
          console.error("[App] Failed to save terms to Supabase:", result.error);
        }
        return;
      }

      // POST-DB FLOW: Use normal acceptTerms from auth context
      await acceptTerms();
    } catch (error) {
      console.error("[App] Failed to accept terms:", error);
    }
  };

  const handleDeclineTerms = async (): Promise<void> => {
    // For pre-DB flow, declining means going back to login
    if (pendingOAuthData && !isAuthenticated) {
      setPendingOAuthData(null);
      setPendingOnboardingData({
        termsAccepted: false,
        phoneType: null,
        emailConnected: false,
        emailProvider: null,
      });
      setShowTermsModal(false);
      setCurrentStep("login");
      return;
    }
    await declineTerms();
  };

  // Handle phone type selection - works in both pre-DB and post-DB flows
  const handleSelectIPhone = async (): Promise<void> => {
    // PRE-DB FLOW: Store in memory, will be persisted after DB init
    if (pendingOAuthData && !isAuthenticated) {
      setSelectedPhoneType("iphone");
      setPendingOnboardingData((prev: PendingOnboardingData) => ({ ...prev, phoneType: "iphone" }));
      // Navigation will be handled by useEffect
      return;
    }

    // POST-DB FLOW: Save to database
    if (!currentUser?.id) return;

    try {
      const userApi = window.api.user as {
        setPhoneType: (
          userId: string,
          phoneType: "iphone" | "android",
        ) => Promise<{ success: boolean; error?: string }>;
      };
      const result = await userApi.setPhoneType(currentUser.id, "iphone");
      if (result.success) {
        setSelectedPhoneType("iphone");
        // On Windows, show Apple driver setup before continuing
        // On macOS, drivers are bundled with the OS
        if (isWindows) {
          setCurrentStep("apple-driver-setup");
        } else {
          setHasSelectedPhoneType(true);
          // Continue to email onboarding (flow will be handled by useEffect)
        }
      } else {
        console.error("[App] Failed to save phone type:", result.error);
      }
    } catch (error) {
      console.error("[App] Error saving phone type:", error);
    }
  };

  // Handle Apple driver setup completion (Windows only)
  const handleAppleDriverSetupComplete = (): void => {
    setNeedsDriverSetup(false);
    setHasSelectedPhoneType(true);
    // Continue to email onboarding (flow will be handled by useEffect)
  };

  // Handle Apple driver setup skip (Windows only)
  const handleAppleDriverSetupSkip = (): void => {
    // User chose to skip - they can set up drivers later
    setNeedsDriverSetup(false);
    setHasSelectedPhoneType(true);
    // Continue to email onboarding (flow will be handled by useEffect)
  };

  const handleSelectAndroid = (): void => {
    setSelectedPhoneType("android");
    // Don't set hasSelectedPhoneType yet - show coming soon screen first
    setCurrentStep("android-coming-soon");
  };

  const handleAndroidGoBack = (): void => {
    // Go back to phone type selection
    setSelectedPhoneType(null);
    setCurrentStep("phone-type-selection");
  };

  const handleAndroidContinueWithEmail = async (): Promise<void> => {
    // PRE-DB FLOW: Store in memory
    if (pendingOAuthData && !isAuthenticated) {
      setPendingOnboardingData((prev: PendingOnboardingData) => ({ ...prev, phoneType: "android" }));
      // Navigation will be handled by useEffect
      return;
    }

    // POST-DB FLOW: Save to database
    if (!currentUser?.id) return;

    try {
      const userApi = window.api.user as {
        setPhoneType: (
          userId: string,
          phoneType: "iphone" | "android",
        ) => Promise<{ success: boolean; error?: string }>;
      };
      const result = await userApi.setPhoneType(currentUser.id, "android");
      if (result.success) {
        setHasSelectedPhoneType(true);
        // selectedPhoneType is already 'android' from handleSelectAndroid
        // Continue to email onboarding (flow will be handled by useEffect)
      } else {
        console.error("[App] Failed to save phone type:", result.error);
      }
    } catch (error) {
      console.error("[App] Error saving phone type:", error);
    }
  };

  // Handle phone type change during email onboarding (saves to DB without changing current step)
  const handlePhoneTypeChange = async (
    phoneType: "iphone" | "android",
  ): Promise<void> => {
    // PRE-DB FLOW: Store in memory
    if (pendingOAuthData && !isAuthenticated) {
      setSelectedPhoneType(phoneType);
      setPendingOnboardingData((prev: PendingOnboardingData) => ({ ...prev, phoneType }));
      return;
    }

    // POST-DB FLOW: Save to database
    if (!currentUser?.id) return;

    try {
      const userApi = window.api.user as {
        setPhoneType: (
          userId: string,
          phoneType: "iphone" | "android",
        ) => Promise<{ success: boolean; error?: string }>;
      };
      const result = await userApi.setPhoneType(currentUser.id, phoneType);
      if (result.success) {
        setSelectedPhoneType(phoneType);
      } else {
        console.error("[App] Failed to save phone type:", result.error);
      }
    } catch (error) {
      console.error("[App] Error saving phone type:", error);
    }
  };

  const handleLogout = async (): Promise<void> => {
    await logout();
    setShowProfile(false);
    setIsNewUserFlow(false);
    // Phone type is stored in database per user, no need to clear on logout
    // It will be loaded fresh when a user logs in
    setHasSelectedPhoneType(false);
    setSelectedPhoneType(null);
    setCurrentStep("login");
  };

  // Handler for keychain explanation screen
  // Called after all pre-DB onboarding steps are complete (Terms → Phone → Email → Keychain)
  const handleKeychainExplanationContinue = async (dontShowAgain: boolean) => {
    // Save preference if user checked "don't show again"
    if (dontShowAgain) {
      localStorage.setItem("skipKeychainExplanation", "true");
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
            const loginResult =
              await window.api.auth.completePendingLogin(pendingOAuthData);
            if (
              loginResult.success &&
              loginResult.user &&
              loginResult.sessionToken
            ) {
              const subscriptionData = loginResult.subscription as
                | Subscription
                | undefined;
              const user = loginResult.user as {
                id: string;
                email: string;
                display_name?: string;
                avatar_url?: string;
              };

              // Persist pending onboarding data now that DB is initialized
              const userId = loginResult.user.id;

              // Save phone type if selected during pre-DB onboarding
              if (pendingOnboardingData.phoneType) {
                try {
                  const userApi = window.api.user as {
                    setPhoneType: (
                      userId: string,
                      phoneType: "iphone" | "android",
                    ) => Promise<{ success: boolean; error?: string }>;
                  };
                  await userApi.setPhoneType(userId, pendingOnboardingData.phoneType);
                  setHasSelectedPhoneType(true);
                } catch (phoneError) {
                  console.error("[App] Failed to persist phone type:", phoneError);
                }
              }

              // Mark email onboarding as complete if done during pre-DB
              if (pendingOnboardingData.emailConnected) {
                try {
                  const authApi = window.api.auth as typeof window.api.auth & {
                    completeEmailOnboarding: (
                      userId: string,
                    ) => Promise<{ success: boolean; error?: string }>;
                  };
                  await authApi.completeEmailOnboarding(userId);
                  setHasCompletedEmailOnboarding(true);
                  setHasEmailConnected(pendingOnboardingData.emailProvider !== null);
                } catch (emailError) {
                  console.error("[App] Failed to persist email onboarding:", emailError);
                }
              }

              // Clear pending onboarding data
              setPendingOnboardingData({
                termsAccepted: false,
                phoneType: null,
                emailConnected: false,
                emailProvider: null,
              });

              // Call the auth context login
              setIsNewUserFlow(loginResult.isNewUser || false);
              setPendingOAuthData(null);
              login(
                user,
                loginResult.sessionToken,
                pendingOAuthData.provider,
                subscriptionData,
                loginResult.isNewUser || false,
              );
            } else {
              console.error(
                "[App] Failed to complete pending login:",
                loginResult.error,
              );
              setPendingOAuthData(null);
              // Navigation will show login screen again
            }
          } catch (error) {
            console.error("[App] Error completing pending login:", error);
            setPendingOAuthData(null);
          }
        }
        // If no pending OAuth data, navigation will show login screen
      } else {
        console.error("[App] Database initialization failed:", result.error);
        // Show error state - user can retry
      }
    } catch (error) {
      console.error("[App] Database initialization error:", error);
    } finally {
      setIsInitializingDatabase(false);
    }
  };

  const checkPermissions = async (): Promise<void> => {
    // On Windows, there's no Full Disk Access to check - skip permission check
    if (isWindows) {
      setHasPermissions(true);
      return;
    }

    // macOS: Check for Full Disk Access permission
    const result = await window.electron.checkPermissions();
    if (result.hasPermission) {
      setHasPermissions(true);
    }
  };

  const checkAppLocation = async (): Promise<void> => {
    try {
      const result = await window.electron.checkAppLocation();
      setAppPath(result.appPath || "");

      // Check if we should show the prompt
      // Only show if:
      // 1. shouldPrompt is true (not in Applications and in temp location)
      // 2. User hasn't dismissed it permanently
      const hasIgnored = localStorage.getItem("ignoreMoveAppPrompt");
      if (result.shouldPrompt && !hasIgnored) {
        setShowMoveAppPrompt(true);
      }
    } catch (error) {
      console.error("[App] Error checking app location:", error);
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
          completeEmailOnboarding: (
            userId: string,
          ) => Promise<{ success: boolean; error?: string }>;
        };
        await authApi.completeEmailOnboarding(currentUser.id);
        setHasCompletedEmailOnboarding(true);
      } catch (error) {
        console.error("[App] Failed to complete email onboarding:", error);
      }
    }
  };

  const handleEmailOnboardingComplete = async () => {
    // PRE-DB FLOW: Store in memory, then proceed to keychain/DB init
    if (pendingOAuthData && !isAuthenticated) {
      setPendingOnboardingData((prev: PendingOnboardingData) => ({
        ...prev,
        emailConnected: true,
        emailProvider: pendingOAuthData.provider,
      }));
      // Navigation will be handled by useEffect - will show keychain-explanation (Mac) or auto-init DB (Windows)
      return;
    }

    // POST-DB FLOW: Save to database
    await completeEmailOnboarding();
    setHasEmailConnected(true);
    // Navigate to permissions or dashboard
    if (hasPermissions) {
      setCurrentStep("dashboard");
    } else {
      setCurrentStep("permissions");
    }
  };

  const handleEmailOnboardingSkip = async () => {
    // PRE-DB FLOW: Mark as "connected" to proceed, but no actual email connected
    if (pendingOAuthData && !isAuthenticated) {
      setPendingOnboardingData((prev: PendingOnboardingData) => ({
        ...prev,
        emailConnected: true, // Allow proceeding, but emailProvider stays null
      }));
      // Navigation will be handled by useEffect
      return;
    }

    // POST-DB FLOW: Save to database
    // Skipping also marks onboarding as complete so user doesn't see full screen again
    // Dashboard will show prompt based on whether email is actually connected
    await completeEmailOnboarding();
    // Navigate to permissions or dashboard
    if (hasPermissions) {
      setCurrentStep("dashboard");
    } else {
      setCurrentStep("permissions");
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
      setConnectionError(
        "Unable to connect. Please check your internet connection.",
      );
    }
  }, [checkConnection, setConnectionError]);

  const handleMicrosoftLogin = (_userInfo: unknown) => {
    setOutlookConnected(true);
    // Check if we already have permissions
    if (hasPermissions) {
      setCurrentStep("dashboard");
    } else {
      setCurrentStep("permissions");
    }
  };

  const handleMicrosoftSkip = () => {
    setOutlookConnected(false);
    // Check if we already have permissions
    if (hasPermissions) {
      setCurrentStep("dashboard");
    } else {
      setCurrentStep("permissions");
    }
  };

  const handleConnectOutlook = () => {
    // Navigate back to Microsoft login screen
    setCurrentStep("microsoft-login");
  };

  const handlePermissionsGranted = () => {
    setHasPermissions(true);
    setCurrentStep("dashboard");
  };

  const handleExportComplete = (result: any) => {
    setExportResult(result as AppExportResult);
    setCurrentStep("complete");
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
    setCurrentStep("outlook");
  };

  const handleOutlookCancel = () => {
    setCurrentStep("dashboard");
  };

  const handleStartOver = () => {
    setExportResult(null);
    setSelectedConversationIds(new Set()); // Clear selected conversations
    setCurrentStep("dashboard");
  };

  const getPageTitle = (): string => {
    switch (currentStep) {
      case "login":
        return "Welcome";
      case "email-onboarding":
        return "Connect Email";
      case "microsoft-login":
        return "Login";
      case "permissions":
        return "Setup Permissions";
      case "dashboard":
        return "Magic Audit";
      case "contacts":
        return "Select Contacts for Export";
      case "outlook":
        return "Export to Outlook";
      case "complete":
        return "Export Complete";
      default:
        return "Magic Audit";
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Title Bar - Hide on login screen */}
      {currentStep !== "login" && (
        <div className="flex-shrink-0 bg-gradient-to-b from-gray-100 to-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between select-none">
          <div className="w-8" /> {/* Spacer for centering */}
          <h1 className="text-sm font-semibold text-gray-700">
            {getPageTitle()}
          </h1>
          {/* User Menu Button */}
          {isAuthenticated && currentUser && (
            <button
              onClick={() => setShowProfile(true)}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-md transition-all hover:shadow-lg"
              title={`${currentUser.display_name || currentUser.email} - Click for account settings`}
              data-tour="profile-button"
            >
              {currentUser.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt="Profile"
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                currentUser.display_name?.[0]?.toUpperCase() ||
                currentUser.email?.[0]?.toUpperCase() ||
                "?"
              )}
            </button>
          )}
        </div>
      )}

      {/* Offline Banner - Show when network is unavailable */}
      {!isOnline && currentStep !== "login" && (
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
                  Some features may be limited. Your local data is still
                  accessible.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRetryConnection}
                disabled={isChecking}
                className="px-3 py-1.5 text-xs font-medium text-yellow-800 bg-yellow-200 hover:bg-yellow-300 rounded-md transition-colors disabled:opacity-50"
              >
                {isChecking ? "Checking..." : "Retry"}
              </button>
              <button
                onClick={() =>
                  window.api?.system?.contactSupport?.(
                    "Network connection issue",
                  )
                }
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
        {currentStep === "loading" && (
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-blue-600 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">Starting Magic Audit...</p>
            </div>
          </div>
        )}

        {/* Show full offline screen during login when network is unavailable */}
        {currentStep === "login" && !isOnline ? (
          <OfflineFallback
            isOffline={true}
            isRetrying={isChecking}
            error={connectionError}
            onRetry={handleRetryConnection}
            mode="fullscreen"
          />
        ) : currentStep === "login" ? (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onLoginPending={handleLoginPending}
          />
        ) : null}

        {currentStep === "keychain-explanation" && isMacOS && (
          <KeychainExplanation
            onContinue={handleKeychainExplanationContinue}
            isLoading={isInitializingDatabase}
            hasPendingLogin={!!pendingOAuthData}
            skipExplanation={skipKeychainExplanation}
          />
        )}

        {currentStep === "phone-type-selection" && (
          <PhoneTypeSelection
            onSelectIPhone={handleSelectIPhone}
            onSelectAndroid={handleSelectAndroid}
            selectedType={selectedPhoneType}
          />
        )}

        {currentStep === "android-coming-soon" && (
          <AndroidComingSoon
            onGoBack={handleAndroidGoBack}
            onContinueWithEmail={handleAndroidContinueWithEmail}
          />
        )}

        {currentStep === "apple-driver-setup" && isWindows && (
          <AppleDriverSetup
            onComplete={handleAppleDriverSetupComplete}
            onSkip={handleAppleDriverSetupSkip}
          />
        )}

        {/* Email onboarding - works in both pre-DB (pendingOAuthData) and post-DB (currentUser) flows */}
        {currentStep === "email-onboarding" &&
          (currentUser || pendingOAuthData) &&
          (authProvider || pendingOAuthData?.provider) && (
            <EmailOnboardingScreen
              userId={currentUser?.id || pendingOAuthData?.cloudUser.id || ""}
              authProvider={
                (authProvider || pendingOAuthData?.provider) as
                  | "google"
                  | "microsoft"
              }
              selectedPhoneType={
                selectedPhoneType || pendingOnboardingData.phoneType
              }
              onPhoneTypeChange={handlePhoneTypeChange}
              onComplete={handleEmailOnboardingComplete}
              onSkip={handleEmailOnboardingSkip}
            />
          )}

        {currentStep === "microsoft-login" && (
          <MicrosoftLogin
            onLoginComplete={handleMicrosoftLogin}
            onSkip={handleMicrosoftSkip}
          />
        )}

        {currentStep === "permissions" && isMacOS && (
          <PermissionsScreen
            onPermissionsGranted={handlePermissionsGranted}
            onCheckAgain={checkPermissions}
          />
        )}

        {currentStep === "dashboard" && (
          <Dashboard
            onAuditNew={() => setShowAuditTransaction(true)}
            onViewTransactions={() => setShowTransactions(true)}
            onManageContacts={() => setShowContacts(true)}
            onTourStateChange={setIsTourActive}
            showSetupPrompt={!hasEmailConnected && !showSetupPromptDismissed}
            onContinueSetup={() => setCurrentStep("email-onboarding")}
            onDismissSetupPrompt={handleDismissSetupPrompt}
          />
        )}

        {currentStep === "contacts" && (
          <ConversationList
            onExportComplete={handleExportComplete}
            onOutlookExport={handleOutlookExport}
            onConnectOutlook={handleConnectOutlook}
            outlookConnected={outlookConnected}
          />
        )}

        {currentStep === "outlook" && (
          <OutlookExport
            conversations={conversations}
            selectedIds={selectedConversationIds}
            onComplete={(results: OutlookExportResults | null) => {
              if (results) {
                setExportResult({
                  exportPath: results.exportPath,
                  results: results.results?.map((r) => ({
                    contactName: r.contactName,
                    success: r.success,
                  })),
                });
              } else {
                setExportResult(null);
              }
              setCurrentStep("complete");
            }}
            onCancel={handleOutlookCancel}
          />
        )}

        {currentStep === "complete" && exportResult && (
          <ExportComplete result={exportResult} onStartOver={handleStartOver} />
        )}

        {/* Version Info Button - Bottom Left */}
        <button
          onClick={() => setShowVersion(!showVersion)}
          className="fixed bottom-4 left-4 w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-800 transition-all shadow-md z-50"
          title="Version Info"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
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
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Version:</span>
                <span className="font-mono font-semibold text-gray-900">
                  1.0.7
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Update:</span>
                <span className="font-mono text-gray-700 bg-green-100 px-1 rounded">
                  ✨ Clean Filenames
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-gray-500 text-xs">MagicAudit</p>
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
      {/* Only show when email is connected - if not connected, Dashboard shows setup prompt instead */}
      {isAuthenticated &&
        currentUser &&
        authProvider &&
        hasPermissions &&
        currentStep === "dashboard" &&
        hasEmailConnected && (
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
      {/* Shows during pre-DB onboarding (showTermsModal) or post-DB (needsTermsAcceptance) */}
      {(showTermsModal || (needsTermsAcceptance && currentUser)) && (
        <WelcomeTerms
          user={
            currentUser ||
            (pendingOAuthData
              ? {
                  id: pendingOAuthData.cloudUser.id,
                  email: pendingOAuthData.userInfo.email,
                  display_name: pendingOAuthData.userInfo.name,
                  avatar_url: pendingOAuthData.userInfo.picture,
                }
              : { id: "", email: "" })
          }
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
