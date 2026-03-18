import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { LLMSettings } from "./settings/LLMSettings";
import { MacOSMessagesImportSettings } from "./settings/MacOSMessagesImportSettings";
import { ContactsImportSettings } from "./settings/MacOSContactsImportSettings";
import { ImportSourceSettings } from "./settings/ImportSourceSettings";
import { FeatureGate } from "./common/FeatureGate";
import { SettingsTabBar } from "./settings/SettingsTabBar";
import { useNotification } from "@/hooks/useNotification";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { useFeatureGate } from "@/hooks/useFeatureGate";
import {
  emitEmailConnectionChanged,
  useEmailConnectionListener,
} from "@/utils/emailConnectionEvents";
import { useNetwork } from '../contexts/NetworkContext';
import { OfflineNotice } from './common/OfflineNotice';
import { useSyncOrchestrator } from '../hooks/useSyncOrchestrator';
import { settingsService, authService } from '../services';
import logger from '../utils/logger';
import { formatFileSize } from '../utils/formatUtils';
import { SupportTicketDialog } from './support/SupportTicketDialog';

interface ConnectionError {
  type: string;
  userMessage: string;
  action?: string;
  actionHandler?: string;
}

interface ConnectionStatus {
  connected: boolean;
  email?: string;
  error?: ConnectionError | null;
}

interface Connections {
  google: ConnectionStatus | null;
  microsoft: ConnectionStatus | null;
}

// Refresh interval for connection status (60 seconds)
const CONNECTION_REFRESH_INTERVAL = 60000;

interface PreferencesResult {
  success: boolean;
  error?: string;
  preferences?: {
    export?: {
      defaultFormat?: string;
    };
    scan?: {
      lookbackMonths?: number; // Legacy (TASK-2072: no longer used for scan, kept for read compat)
    };
    sync?: {
      autoSyncOnLogin?: boolean;
    };
    updates?: {
      autoDownload?: boolean;
    };
    notifications?: {
      enabled?: boolean;
    };
    contactSources?: {
      direct?: {
        outlookContacts?: boolean;
        gmailContacts?: boolean;
        macosContacts?: boolean;
      };
      inferred?: {
        outlookEmails?: boolean;
        gmailEmails?: boolean;
        messages?: boolean;
      };
    };
    emailSync?: {
      lookbackMonths?: number; // Legacy key (backward compat)
    };
    emailCache?: {
      durationMonths?: number; // TASK-2072: new canonical key
    };
    audit?: {
      startDateDefault?: "auto" | "manual";
    };
  };
}

interface ConnectionResult {
  success: boolean;
}

// TASK-2058: Human-readable labels for failure log operations
const OPERATION_LABELS: Record<string, string> = {
  outlook_contacts_sync: "Outlook Contacts Sync",
  gmail_email_fetch: "Gmail Email Fetch",
  outlook_email_fetch: "Outlook Email Fetch",
  preferences_sync: "Preferences Sync",
  sign_out_all_devices: "Sign Out All Devices",
  check_for_updates: "Check for Updates",
  session_sync: "Session Sync",
};

/**
 * TASK-2062: Format a timestamp into a human-readable relative time string.
 * E.g., "Just now", "2 minutes ago", "3 hours ago", "Yesterday", etc.
 */
function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;

  if (diffMs < 0 || isNaN(diffMs)) return "Just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;

  return new Date(isoDate).toLocaleDateString();
}

const SETTINGS_TABS = [
  { id: "settings-general", label: "General" },
  { id: "settings-email", label: "Email" },
  { id: "settings-messages", label: "Messages" },
  { id: "settings-contacts", label: "Contacts" },
  { id: "settings-ai", label: "AI" },
  { id: "settings-security", label: "Security" },
  { id: "settings-data", label: "Data & Privacy" },
  { id: "settings-about", label: "About" },
];

interface SettingsComponentProps {
  onClose: () => void;
  userId: string;
  /** Callback to trigger full logout flow (state machine transition + cleanup) */
  onLogout?: () => Promise<void>;
  /** Callback when email is connected - updates app state */
  onEmailConnected?: (email: string, provider: "google" | "microsoft") => void;
  /** Callback when email is disconnected - updates app state (TASK-1730) */
  onEmailDisconnected?: (provider: "google" | "microsoft") => void;
}

/**
 * Settings Component
 * Application settings and preferences
 */
function Settings({ onClose, userId, onLogout, onEmailConnected, onEmailDisconnected }: SettingsComponentProps) {
  const { notify } = useNotification();
  const { isAllowed } = useFeatureGate();
  const hasAIAddon = isAllowed("ai_detection");
  // TASK-2056: Network status for disabling network-dependent actions
  const { isOnline } = useNetwork();
  // TASK-2150: Orchestrator for routing maintenance operations
  const { queue, requestSync } = useSyncOrchestrator();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const visibleTabs = useMemo(
    () => SETTINGS_TABS.filter((t) => t.id !== "settings-ai" || hasAIAddon),
    [hasAIAddon]
  );
  const visibleTabIds = useMemo(() => visibleTabs.map((t) => t.id), [visibleTabs]);

  const [connections, setConnections] = useState<Connections>({
    google: null,
    microsoft: null,
  });
  const [loadingConnections, setLoadingConnections] = useState<boolean>(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(
    null,
  );
  const [disconnectingProvider, setDisconnectingProvider] = useState<
    string | null
  >(null);
  const [exportFormat, setExportFormat] = useState<string>("pdf"); // Default export format
  const [emailExportMode, setEmailExportMode] = useState<"thread" | "individual">("thread");
  // TASK-2072: scan lookback removed (now automatic via last_sync_at)
  const [emailCacheDurationMonths, setEmailCacheDurationMonths] = useState<number>(3); // TASK-2072: Default 3 months
  const [autoSyncOnLogin, setAutoSyncOnLogin] = useState<boolean>(true); // Default auto-sync ON
  const [autoDownloadUpdates, setAutoDownloadUpdates] = useState<boolean>(false); // Default auto-download OFF
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true); // Default notifications ON
  // Contact source preferences - direct imports (default ON)
  const [outlookContactsEnabled, setOutlookContactsEnabled] = useState<boolean>(true);
  const [gmailContactsEnabled, setGmailContactsEnabled] = useState<boolean>(true);
  const [macosContactsEnabled, setMacosContactsEnabled] = useState<boolean>(true);
  // Contact source preferences - inferred from conversations (default OFF)
  const [outlookEmailsInferred, setOutlookEmailsInferred] = useState<boolean>(false);
  const [gmailEmailsInferred, setGmailEmailsInferred] = useState<boolean>(false);
  const [messagesInferred, setMessagesInferred] = useState<boolean>(false);
  const [loadingPreferences, setLoadingPreferences] = useState<boolean>(true);
  // TASK-1980: Start date default mode preference
  const [startDateDefault, setStartDateDefault] = useState<"auto" | "manual">("manual");

  const activeTabId = useScrollSpy(visibleTabIds, scrollContainerRef, 48, !loadingPreferences);

  const handleTabClick = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // TASK-2045: Sign out all devices state
  const [signingOutAllDevices, setSigningOutAllDevices] = useState<boolean>(false);

  // TASK-2053: CCPA data export state
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportCategory, setExportCategory] = useState<string>("");
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Database maintenance state
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'up-to-date' | 'available' | 'error'>('idle');
  const [updateVersion, setUpdateVersion] = useState<string>('');
  const [reindexing, setReindexing] = useState<boolean>(false);
  const [reindexResult, setReindexResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // TASK-2052: Database backup/restore state
  const [backingUp, setBackingUp] = useState<boolean>(false);
  const [restoring, setRestoring] = useState<boolean>(false);
  const [backupResult, setBackupResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [dbInfo, setDbInfo] = useState<{
    fileSize: number;
    lastModified: string;
  } | null>(null);

  // TASK-2058: Failure log state
  const [failureLogEntries, setFailureLogEntries] = useState<Array<{
    id: number;
    timestamp: string;
    operation: string;
    error_message: string;
    metadata: string | null;
    acknowledged: number;
  }>>([]);
  const [failureLogLoading, setFailureLogLoading] = useState<boolean>(false);

  // TASK-2062: Active sessions/devices state
  const [activeDevices, setActiveDevices] = useState<Array<{
    device_id: string;
    device_name: string;
    os: string;
    platform: string;
    last_seen_at: string;
    isCurrentDevice: boolean;
  }>>([]);
  const [devicesLoading, setDevicesLoading] = useState<boolean>(false);

  // TASK-2180: Support ticket dialog state
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [supportUserEmail, setSupportUserEmail] = useState("");
  const [supportUserName, setSupportUserName] = useState("");

  // Load connection status and preferences on mount, with periodic refresh
  useEffect(() => {
    if (userId) {
      checkConnections();
      loadPreferences();

      // Set up periodic refresh for connection status
      const refreshInterval = setInterval(() => {
        checkConnections();
      }, CONNECTION_REFRESH_INTERVAL);

      return () => clearInterval(refreshInterval);
    }
  }, [userId]);

  // TASK-2058: Load failure log entries
  const loadFailureLog = useCallback(async () => {
    setFailureLogLoading(true);
    try {
      const result = await window.api.failureLog?.getRecent(50);
      if (result?.success) {
        setFailureLogEntries(result.entries);
      }
    } catch (err) {
      logger.error("Failed to load failure log:", err);
    } finally {
      setFailureLogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFailureLog();
  }, [loadFailureLog]);

  // TASK-2062: Load active devices for session management
  const loadActiveDevices = useCallback(async () => {
    if (!userId || !isOnline) return;
    setDevicesLoading(true);
    try {
      const result = await window.api.auth.getActiveDevices(userId);
      if (result?.success && result.devices) {
        setActiveDevices(result.devices);
      }
    } catch (err) {
      logger.error("Failed to load active devices:", err);
    } finally {
      setDevicesLoading(false);
    }
  }, [userId, isOnline]);

  useEffect(() => {
    loadActiveDevices();
  }, [loadActiveDevices]);

  const handleClearFailureLog = async (): Promise<void> => {
    try {
      const result = await window.api.failureLog?.clear();
      if (result?.success) {
        setFailureLogEntries([]);
        notify.success("Diagnostic log cleared.");
      }
    } catch (err) {
      logger.error("Failed to clear failure log:", err);
      notify.error("Failed to clear diagnostic log.");
    }
  };

  // TASK-2052: Load database info for backup/restore section
  useEffect(() => {
    const loadDbInfo = async () => {
      try {
        const result = await window.api.databaseBackup.getInfo();
        if (result.success && result.info) {
          setDbInfo({
            fileSize: result.info.fileSize,
            lastModified: result.info.lastModified,
          });
        }
      } catch (err) {
        logger.error("Failed to load database info:", err);
      }
    };
    loadDbInfo();
  }, []);

  // TASK-1730: Listen for email connection events from other components (e.g., onboarding flow)
  // This ensures Settings UI updates immediately when email is connected elsewhere
  useEmailConnectionListener(
    useCallback(() => {
      // Refresh connection status when email connection state changes
      checkConnections();
    }, [])
  );

  /**
   * Check all email connections and update state.
   * Returns the connection result for callers that need immediate access to the data.
   */
  const checkConnections = async (): Promise<{
    google?: { connected: boolean; email?: string };
    microsoft?: { connected: boolean; email?: string };
  } | null> => {
    setLoadingConnections(true);
    try {
      const result = await window.api.system.checkAllConnections(userId);
      if (result.success) {
        setConnections({
          google: result.google
            ? {
                connected: result.google.connected,
                email: result.google.email,
                error: result.google.error,
              }
            : null,
          microsoft: result.microsoft
            ? {
                connected: result.microsoft.connected,
                email: result.microsoft.email,
                error: result.microsoft.error,
              }
            : null,
        });
        // Return the result for immediate use by callers
        return {
          google: result.google,
          microsoft: result.microsoft,
        };
      }
      return null;
    } catch (error) {
      logger.error("Failed to check connections:", error);
      return null;
    } finally {
      setLoadingConnections(false);
    }
  };

  const loadPreferences = async (): Promise<void> => {
    setLoadingPreferences(true);
    try {
      const result = await settingsService.getPreferences(userId);
      const prefs = result.data as PreferencesResult['preferences'];
      if (result.success && prefs) {
        // Load export format preference
        if (prefs.export?.defaultFormat) {
          setExportFormat(prefs.export.defaultFormat);
        }
        // Load email export mode preference
        const loadedEmailMode = (prefs.export as { emailExportMode?: string } | undefined)?.emailExportMode;
        if (loadedEmailMode === "thread" || loadedEmailMode === "individual") {
          setEmailExportMode(loadedEmailMode);
        }
        // TASK-2072: Load email cache duration (new key, with fallback to legacy key)
        const loadedEmailCache = prefs.emailCache?.durationMonths
          ?? prefs.emailSync?.lookbackMonths;
        if (typeof loadedEmailCache === "number" && loadedEmailCache > 0) {
          setEmailCacheDurationMonths(loadedEmailCache);
        }
        // Load auto-sync preference (default is true if not set)
        if (typeof prefs.sync?.autoSyncOnLogin === "boolean") {
          setAutoSyncOnLogin(prefs.sync.autoSyncOnLogin);
        }
        // Load auto-download updates preference (default is false if not set)
        if (typeof prefs.updates?.autoDownload === "boolean") {
          setAutoDownloadUpdates(prefs.updates.autoDownload);
        }
        // Load notifications preference (default is true if not set)
        if (typeof prefs.notifications?.enabled === "boolean") {
          setNotificationsEnabled(prefs.notifications.enabled);
        }
        // TASK-1980: Load start date default mode preference
        const loadedStartDateDefault = prefs.audit?.startDateDefault;
        if (loadedStartDateDefault === "auto" || loadedStartDateDefault === "manual") {
          setStartDateDefault(loadedStartDateDefault);
        }
        // Load contact source preferences
        if (prefs.contactSources) {
          const cs = prefs.contactSources;
          if (cs.direct) {
            if (typeof cs.direct.outlookContacts === "boolean") setOutlookContactsEnabled(cs.direct.outlookContacts);
            if (typeof cs.direct.gmailContacts === "boolean") setGmailContactsEnabled(cs.direct.gmailContacts);
            if (typeof cs.direct.macosContacts === "boolean") setMacosContactsEnabled(cs.direct.macosContacts);
          }
          if (cs.inferred) {
            if (typeof cs.inferred.outlookEmails === "boolean") setOutlookEmailsInferred(cs.inferred.outlookEmails);
            if (typeof cs.inferred.gmailEmails === "boolean") setGmailEmailsInferred(cs.inferred.gmailEmails);
            if (typeof cs.inferred.messages === "boolean") setMessagesInferred(cs.inferred.messages);
          }
        }
      } else if (!result.success) {
        logger.error("[Settings] Failed to load preferences:", result.error);
      }
    } catch (error) {
      // Log preference loading errors for debugging
      logger.error("[Settings] Error loading preferences:", error);
    } finally {
      setLoadingPreferences(false);
    }
  };

  const handleExportFormatChange = async (newFormat: string): Promise<void> => {
    setExportFormat(newFormat);
    try {
      // Update only the export format preference
      await settingsService.updatePreferences(userId, {
        export: {
          defaultFormat: newFormat,
        },
      });
      // Silently handle - preference will still be applied locally for this session
    } catch {
      // Silently handle - preference will still be applied locally for this session
    }
  };

  const handleEmailExportModeChange = async (mode: "thread" | "individual"): Promise<void> => {
    setEmailExportMode(mode);
    try {
      await settingsService.updatePreferences(userId, {
        export: {
          emailExportMode: mode,
        },
      });
    } catch (err) {
      logger.error("Failed to save email export mode preference:", err);
    }
  };

  // TASK-2072: Handle email cache duration change
  const handleEmailCacheDurationChange = async (months: number): Promise<void> => {
    setEmailCacheDurationMonths(months);
    try {
      const result = await settingsService.updatePreferences(userId, {
        emailCache: {
          durationMonths: months,
        },
      });
      if (!result.success) {
        logger.error("[Settings] Failed to save email cache duration:", result);
      }
    } catch (error) {
      logger.error("[Settings] Error saving email cache duration:", error);
    }
  };

  // TASK-1980: Handle start date default mode change
  const handleStartDateDefaultChange = async (mode: "auto" | "manual"): Promise<void> => {
    setStartDateDefault(mode);
    try {
      const result = await settingsService.updatePreferences(userId, {
        audit: {
          startDateDefault: mode,
        },
      });
      if (!result.success) {
        logger.error("[Settings] Failed to save start date default:", result);
      }
    } catch (error) {
      logger.error("[Settings] Error saving start date default:", error);
    }
  };

  const handleAutoSyncToggle = async (): Promise<void> => {
    const newValue = !autoSyncOnLogin;
    setAutoSyncOnLogin(newValue);
    try {
      // Update auto-sync preference
      await settingsService.updatePreferences(userId, {
        sync: {
          autoSyncOnLogin: newValue,
        },
      });
      // Silently handle - preference will still be applied locally for this session
    } catch {
      // Silently handle - preference will still be applied locally for this session
    }
  };

  const handleAutoDownloadToggle = async (): Promise<void> => {
    const newValue = !autoDownloadUpdates;
    setAutoDownloadUpdates(newValue);
    try {
      // Update auto-download updates preference
      await settingsService.updatePreferences(userId, {
        updates: {
          autoDownload: newValue,
        },
      });
      // Silently handle - preference will still be applied locally for this session
    } catch {
      // Silently handle - preference will still be applied locally for this session
    }
  };

  const handleCheckForUpdates = useCallback(async (): Promise<void> => {
    setUpdateStatus('checking');
    try {
      const result = await window.api.update.checkForUpdates();
      if (result?.updateAvailable) {
        setUpdateStatus('available');
        setUpdateVersion(result.version ?? '');
      } else {
        setUpdateStatus('up-to-date');
      }
    } catch {
      setUpdateStatus('error');
    }
    // Auto-reset after 5 seconds
    setTimeout(() => setUpdateStatus('idle'), 5000);
  }, []);

  const handleNotificationsToggle = async (): Promise<void> => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    try {
      // Update notifications preference
      await settingsService.updatePreferences(userId, {
        notifications: {
          enabled: newValue,
        },
      });
      // Silently handle - preference will still be applied locally for this session
    } catch {
      // Silently handle - preference will still be applied locally for this session
    }
  };

  const handleTestNotification = async (): Promise<void> => {
    try {
      const result = await window.api.notification?.send(
        "Test Notification",
        "Desktop notifications are working correctly."
      );
      if (result?.success) {
        notify.success("Desktop notification sent! Check your notification center if you don't see a banner.");
      } else {
        notify.warning(result?.error || "Notifications may not be supported on this system.");
      }
    } catch {
      notify.error("Failed to send test notification.");
    }
  };

  const handleContactSourceToggle = async (
    category: "direct" | "inferred",
    key: string,
    currentValue: boolean,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
  ): Promise<void> => {
    const newValue = !currentValue;
    setter(newValue);
    try {
      await settingsService.updatePreferences(userId, {
        contactSources: {
          [category]: {
            [key]: newValue,
          },
        },
      });
    } catch {
      // Silently handle - preference will still be applied locally for this session
    }
  };

  const handleConnectGoogle = async (): Promise<void> => {
    setConnectingProvider("google");
    let cleanup: (() => void) | undefined;
    try {
      const result = await authService.googleConnectMailbox(userId);
      if (result.success) {
        // Auth popup window opens automatically and will close when done
        // Listen for connection completion
        cleanup = authService.onMailboxConnected("google",
          async (connectionResult: ConnectionResult) => {
            if (connectionResult.success) {
              // Refresh connections and get the result in one call
              const connResult = await checkConnections();
              const email = connResult?.google?.email;
              // Notify parent to update app state so banner disappears
              if (email && onEmailConnected) {
                onEmailConnected(email, "google");
              }
              // TASK-1730: Emit event for cross-component state propagation
              if (email) {
                emitEmailConnectionChanged({
                  connected: true,
                  email,
                  provider: "google",
                });
              }
            }
            setConnectingProvider(null);
            if (cleanup) cleanup();
          },
        );
      }
    } catch (error) {
      logger.error("Failed to connect Google:", error);
      setConnectingProvider(null);
      if (cleanup) cleanup();
    }
  };

  const handleConnectMicrosoft = async (): Promise<void> => {
    setConnectingProvider("microsoft");
    let cleanup: (() => void) | undefined;
    try {
      const result = await authService.microsoftConnectMailbox(userId);
      if (result.success) {
        // Auth popup window opens automatically and will close when done
        // Listen for connection completion
        cleanup = authService.onMailboxConnected("microsoft",
          async (connectionResult: ConnectionResult) => {
            if (connectionResult.success) {
              // Refresh connections and get the result in one call
              const connResult = await checkConnections();
              const email = connResult?.microsoft?.email;
              // Notify parent to update app state so banner disappears
              if (email && onEmailConnected) {
                onEmailConnected(email, "microsoft");
              }
              // TASK-1730: Emit event for cross-component state propagation
              if (email) {
                emitEmailConnectionChanged({
                  connected: true,
                  email,
                  provider: "microsoft",
                });
              }
            }
            setConnectingProvider(null);
            if (cleanup) cleanup();
          },
        );
      }
    } catch (error) {
      logger.error("Failed to connect Microsoft:", error);
      setConnectingProvider(null);
      if (cleanup) cleanup();
    }
  };

  const handleDisconnectGoogle = async (): Promise<void> => {
    setDisconnectingProvider("google");
    try {
      const result = await authService.googleDisconnectMailbox(userId);
      if (result.success) {
        await checkConnections();
        // TASK-1730: Notify parent to update app state machine
        if (onEmailDisconnected) {
          onEmailDisconnected("google");
        }
        // TASK-1730: Emit event for cross-component state propagation
        emitEmailConnectionChanged({ connected: false, provider: "google" });
      }
    } catch (error) {
      logger.error("Failed to disconnect Google:", error);
    } finally {
      setDisconnectingProvider(null);
    }
  };

  const handleDisconnectMicrosoft = async (): Promise<void> => {
    setDisconnectingProvider("microsoft");
    try {
      const result = await authService.microsoftDisconnectMailbox(userId);
      if (result.success) {
        await checkConnections();
        // TASK-1730: Notify parent to update app state machine
        if (onEmailDisconnected) {
          onEmailDisconnected("microsoft");
        }
        // TASK-1730: Emit event for cross-component state propagation
        emitEmailConnectionChanged({ connected: false, provider: "microsoft" });
      }
    } catch (error) {
      logger.error("Failed to disconnect Microsoft:", error);
    } finally {
      setDisconnectingProvider(null);
    }
  };

  const handleSelectChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    handleExportFormatChange(e.target.value);
  };

  // TASK-2180: Open support ticket dialog
  const handleContactSupport = async (): Promise<void> => {
    try {
      const result = await authService.getCurrentUser();
      if (result.success && result.data) {
        const user = result.data.user;
        setSupportUserEmail(user.email || "");
        setSupportUserName(
          user.display_name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email || ""
        );
      } else {
        setSupportUserEmail("");
        setSupportUserName("");
      }
    } catch {
      setSupportUserEmail("");
      setSupportUserName("");
    }
    setShowSupportDialog(true);
  };

  // TASK-2045: Handle sign out of all devices
  const handleSignOutAllDevices = async (): Promise<void> => {
    const confirmed = window.confirm(
      "This will sign you out of all devices, including this one. You will need to log in again.\n\nContinue?"
    );
    if (!confirmed) return;

    setSigningOutAllDevices(true);
    try {
      const result = await window.api.auth.signOutAllDevices();
      if (result.success) {
        // Use the app's logout flow to transition state machine to "unauthenticated"
        if (onLogout) {
          await onLogout();
        }
      } else {
        notify.error("Failed to sign out of all devices: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      logger.error("Failed to sign out of all devices:", error);
      notify.error("Failed to sign out of all devices. Please try again.");
    } finally {
      setSigningOutAllDevices(false);
    }
  };

  // TASK-2053/2150: Handle CCPA data export -- routed through orchestrator
  const handleExportData = (): void => {
    setExportResult(null);
    requestSync(['ccpa-export'], userId);
  };

  // TASK-2150: Reindex routed through orchestrator
  const handleReindexDatabase = (): void => {
    // Show confirmation with freeze warning
    const confirmed = window.confirm(
      "This will optimize the database for better performance.\n\n" +
        "Note: The app may briefly freeze during this process. This is normal and should only take a few seconds.\n\n" +
        "Continue?",
    );
    if (!confirmed) return;

    setReindexResult(null);
    requestSync(['reindex'], userId);
  };

  // TASK-2052/2150: Backup database handler -- routed through orchestrator
  const handleBackupDatabase = (): void => {
    setBackupResult(null);
    requestSync(['backup'], userId);
  };

  // TASK-2052/2150: Restore database handler -- routed through orchestrator
  const handleRestoreDatabase = (): void => {
    setBackupResult(null);
    requestSync(['restore'], userId);
  };

  // =========================================================================
  // TASK-2150: Derive operation-in-progress state from orchestrator queue
  // =========================================================================
  const reindexItem = queue.find(q => q.type === 'reindex');
  const backupItem = queue.find(q => q.type === 'backup');
  const restoreItem = queue.find(q => q.type === 'restore');
  const ccpaItem = queue.find(q => q.type === 'ccpa-export');

  // Derive running state from orchestrator (overrides local state)
  const reindexRunning = reindexItem?.status === 'running' || reindexItem?.status === 'pending';
  const backupRunning = backupItem?.status === 'running' || backupItem?.status === 'pending';
  const restoreRunning = restoreItem?.status === 'running' || restoreItem?.status === 'pending';
  const exportRunning = ccpaItem?.status === 'running' || ccpaItem?.status === 'pending';

  // Derive progress from orchestrator queue for CCPA export
  const orchestratorExportProgress = ccpaItem?.progress ?? 0;
  const orchestratorExportCategory = ccpaItem?.phase ?? '';

  // Watch orchestrator queue for completion/error and update local result state + notifications
  useEffect(() => {
    if (reindexItem?.status === 'complete') {
      setReindexResult({ success: true, message: 'Database optimized successfully' });
      setReindexing(false);
    } else if (reindexItem?.status === 'error') {
      setReindexResult({ success: false, message: reindexItem.error || 'Failed to optimize database' });
      setReindexing(false);
    }
  }, [reindexItem?.status, reindexItem?.error]);

  useEffect(() => {
    if (backupItem?.status === 'complete') {
      setBackingUp(false);
      if (backupItem.warning !== 'cancelled') {
        setBackupResult({ success: true, message: 'Backup created successfully' });
        notify.success('Database backup created successfully');
      }
    } else if (backupItem?.status === 'error') {
      setBackupResult({ success: false, message: backupItem.error || 'Failed to create backup' });
      notify.error(backupItem.error || 'Failed to create backup');
      setBackingUp(false);
    }
  }, [backupItem?.status, backupItem?.error]);

  useEffect(() => {
    if (restoreItem?.status === 'complete') {
      setRestoring(false);
      if (restoreItem.warning === 'cancelled') return;
      setBackupResult({ success: true, message: 'Database restored successfully' });
      notify.success('Database restored successfully');
      // Refresh database info after successful restore
      window.api.databaseBackup.getInfo().then((infoResult) => {
        if (infoResult.success && infoResult.info) {
          setDbInfo({
            fileSize: infoResult.info.fileSize,
            lastModified: infoResult.info.lastModified,
          });
        }
      }).catch(() => { /* Non-critical */ });
    } else if (restoreItem?.status === 'error') {
      setBackupResult({ success: false, message: restoreItem.error || 'Failed to restore database' });
      notify.error(restoreItem.error || 'Failed to restore database');
      setRestoring(false);
    }
  }, [restoreItem?.status, restoreItem?.error]);

  useEffect(() => {
    if (ccpaItem?.status === 'complete') {
      setExporting(false);
      if (ccpaItem.warning !== 'cancelled') {
        setExportResult({ success: true, message: 'Data exported successfully' });
        notify.success('Your data has been exported successfully.');
      }
    } else if (ccpaItem?.status === 'error') {
      setExportResult({ success: false, message: ccpaItem.error || 'Export failed' });
      notify.error('Failed to export data: ' + (ccpaItem.error || 'Unknown error'));
      setExporting(false);
    }
  }, [ccpaItem?.status, ccpaItem?.error]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
          >
            <svg
              className="w-6 h-6"
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

        {/* Settings Content - Scrollable area */}
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto scroll-smooth scroll-pt-12 px-6 pb-6">
          {loadingPreferences ? (
            <div className="flex flex-col items-center justify-center pt-24 pb-20">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-500">Loading settings...</p>
            </div>
          ) : (
          <>
            <SettingsTabBar
              tabs={visibleTabs}
              activeTabId={activeTabId}
              onTabClick={handleTabClick}
            />
            <div className="sticky top-10 z-10 -mx-6 bg-white">
              <OfflineNotice />
            </div>
            {/* General Settings */}
            <div id="settings-general" className="mt-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                General
              </h3>
              <div className="space-y-4">
                {/* TASK-1980: Start Date Mode Default */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">
                      Start Date Mode
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Default mode for representation start date when creating new audits
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-1">
                    <button
                      onClick={() => handleStartDateDefaultChange("auto")}
                      disabled={loadingPreferences}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        startDateDefault === "auto"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Auto
                    </button>
                    <button
                      onClick={() => handleStartDateDefaultChange("manual")}
                      disabled={loadingPreferences}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        startDateDefault === "manual"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Manual
                    </button>
                  </div>
                </div>

                {/* Auto-Sync on Login */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">
                      Auto-Sync on Login
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Automatically sync emails and messages when you open the app
                    </p>
                  </div>
                  <button
                    onClick={handleAutoSyncToggle}
                    disabled={loadingPreferences}
                    className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      autoSyncOnLogin ? "bg-blue-500" : "bg-gray-300"
                    }`}
                    role="switch"
                    aria-checked={autoSyncOnLogin}
                    aria-label="Auto-sync on login"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        autoSyncOnLogin ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Auto-Download Updates */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        Auto-download Updates
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        Automatically download new software updates in the background
                      </p>
                    </div>
                    <button
                      onClick={handleAutoDownloadToggle}
                      disabled={loadingPreferences}
                      className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        autoDownloadUpdates ? "bg-blue-500" : "bg-gray-300"
                      }`}
                      role="switch"
                      aria-checked={autoDownloadUpdates}
                      aria-label="Auto-download updates"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          autoDownloadUpdates ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  <button
                    onClick={handleCheckForUpdates}
                    disabled={updateStatus === 'checking' || !isOnline}
                    title={!isOnline ? "You are offline" : undefined}
                    className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {!isOnline ? 'Check for Updates' :
                     updateStatus === 'checking' ? 'Checking...' :
                     updateStatus === 'up-to-date' ? 'Up to date' :
                     updateStatus === 'available' ? `Update available (v${updateVersion})` :
                     updateStatus === 'error' ? 'Check failed' :
                     'Check for Updates'}
                  </button>
                </div>

                {/* Notifications */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        Notifications
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        Show desktop notifications for important events
                      </p>
                    </div>
                    <button
                      onClick={handleNotificationsToggle}
                      disabled={loadingPreferences}
                      className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        notificationsEnabled ? "bg-blue-500" : "bg-gray-300"
                      }`}
                      role="switch"
                      aria-checked={notificationsEnabled}
                      aria-label="Desktop notifications"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          notificationsEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  <button
                    onClick={handleTestNotification}
                    disabled={!notificationsEnabled}
                    className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Test Notification
                  </button>
                </div>

                {/* Export Settings (moved from Export tab) */}
                <div className="space-y-3 bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">Default Format</span>
                    <select
                      value={exportFormat}
                      onChange={handleSelectChange}
                      disabled={loadingPreferences}
                      className="text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="pdf">PDF</option>
                      <option value="excel">Excel (.xlsx)</option>
                      <option value="csv">CSV</option>
                      <option value="json">JSON</option>
                      <option value="txt_eml">TXT + EML Files</option>
                    </select>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm text-gray-700">Email Export Mode</span>
                      <p className="text-xs text-gray-500 mt-0.5">How emails are grouped in exported PDFs</p>
                    </div>
                    <select
                      value={emailExportMode}
                      onChange={(e) => handleEmailExportModeChange(e.target.value as "thread" | "individual")}
                      disabled={loadingPreferences}
                      className="text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="thread">Thread (one PDF per conversation)</option>
                      <option value="individual">Individual (one PDF per email, quotes stripped)</option>
                    </select>
                  </div>
                  {/* TODO: Implement export location chooser with native folder picker */}
                  <div className="flex justify-between items-center opacity-50">
                    <span className="text-sm text-gray-700">Export Location</span>
                    <button
                      disabled
                      className="text-sm text-gray-400 font-medium cursor-not-allowed"
                    >
                      Choose Folder
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Connections */}
            <div id="settings-email" className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Email Connections
              </h3>
              <div className="space-y-4">
                {/* Gmail Connection */}
                <div className={`p-4 rounded-lg border ${
                  connections.google?.error && !connections.google?.connected && connections.google.error.type !== "NOT_CONNECTED"
                    ? "bg-yellow-50 border-yellow-200"
                    : "bg-gray-50 border-gray-200"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-red-500"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.545l8.073-6.052C21.69 2.28 24 3.434 24 5.457z" />
                      </svg>
                      <h4 className="text-sm font-medium text-gray-900">
                        Gmail
                      </h4>
                    </div>
                    {loadingConnections ? (
                      <div className="text-xs text-gray-500">Checking...</div>
                    ) : connections.google?.connected ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-600 font-medium">
                          Connected
                        </span>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      </div>
                    ) : connections.google?.error && connections.google.error.type !== "NOT_CONNECTED" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-yellow-600 font-medium">
                          {connections.google.error.type === "TOKEN_REFRESH_FAILED" ||
                           connections.google.error.type === "TOKEN_EXPIRED"
                            ? "Session Expired"
                            : "Connection Issue"}
                        </span>
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          Not Connected
                        </span>
                        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                      </div>
                    )}
                  </div>
                  {connections.google?.email && (
                    <p className="text-xs text-gray-600 mb-2">
                      {connections.google.email}
                    </p>
                  )}
                  {/* Show error message and action prompt when connection has issues (not for NOT_CONNECTED) */}
                  {connections.google?.error && !connections.google?.connected && connections.google.error.type !== "NOT_CONNECTED" && (
                    <div className="mb-3 p-2 bg-yellow-100 rounded text-xs">
                      <p className="text-yellow-800 font-medium">
                        {connections.google.error.userMessage}
                      </p>
                      {connections.google.error.action && (
                        <p className="text-yellow-700 mt-1">
                          {connections.google.error.action}
                        </p>
                      )}
                    </div>
                  )}
                  {connections.google?.connected ? (
                    <button
                      onClick={handleDisconnectGoogle}
                      disabled={disconnectingProvider === "google" || !isOnline}
                      title={!isOnline ? "You are offline" : undefined}
                      className="w-full mt-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {disconnectingProvider === "google"
                        ? "Disconnecting..."
                        : "Disconnect Gmail"}
                    </button>
                  ) : connections.google?.error && connections.google.error.type !== "NOT_CONNECTED" ? (
                    <button
                      onClick={handleConnectGoogle}
                      disabled={connectingProvider === "google" || !isOnline}
                      title={!isOnline ? "You are offline" : undefined}
                      className="w-full mt-2 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connectingProvider === "google"
                        ? "Reconnecting..."
                        : "Reconnect Gmail"}
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectGoogle}
                      disabled={connectingProvider === "google" || !isOnline}
                      title={!isOnline ? "You are offline" : undefined}
                      className="w-full mt-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connectingProvider === "google"
                        ? "Connecting..."
                        : "Connect Gmail"}
                    </button>
                  )}
                </div>

                {/* Outlook Connection */}
                <div className={`p-4 rounded-lg border ${
                  connections.microsoft?.error && !connections.microsoft?.connected && connections.microsoft.error.type !== "NOT_CONNECTED"
                    ? "bg-yellow-50 border-yellow-200"
                    : "bg-gray-50 border-gray-200"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
                        <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                        <rect
                          x="11"
                          y="1"
                          width="9"
                          height="9"
                          fill="#7FBA00"
                        />
                        <rect
                          x="1"
                          y="11"
                          width="9"
                          height="9"
                          fill="#00A4EF"
                        />
                        <rect
                          x="11"
                          y="11"
                          width="9"
                          height="9"
                          fill="#FFB900"
                        />
                      </svg>
                      <h4 className="text-sm font-medium text-gray-900">
                        Outlook
                      </h4>
                    </div>
                    {loadingConnections ? (
                      <div className="text-xs text-gray-500">Checking...</div>
                    ) : connections.microsoft?.connected ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-600 font-medium">
                          Connected
                        </span>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      </div>
                    ) : connections.microsoft?.error && connections.microsoft.error.type !== "NOT_CONNECTED" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-yellow-600 font-medium">
                          {connections.microsoft.error.type === "TOKEN_REFRESH_FAILED" ||
                           connections.microsoft.error.type === "TOKEN_EXPIRED"
                            ? "Session Expired"
                            : "Connection Issue"}
                        </span>
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          Not Connected
                        </span>
                        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                      </div>
                    )}
                  </div>
                  {connections.microsoft?.email && (
                    <p className="text-xs text-gray-600 mb-2">
                      {connections.microsoft.email}
                    </p>
                  )}
                  {/* Show error message and action prompt when connection has issues (not for NOT_CONNECTED) */}
                  {connections.microsoft?.error && !connections.microsoft?.connected && connections.microsoft.error.type !== "NOT_CONNECTED" && (
                    <div className="mb-3 p-2 bg-yellow-100 rounded text-xs">
                      <p className="text-yellow-800 font-medium">
                        {connections.microsoft.error.userMessage}
                      </p>
                      {connections.microsoft.error.action && (
                        <p className="text-yellow-700 mt-1">
                          {connections.microsoft.error.action}
                        </p>
                      )}
                    </div>
                  )}
                  {connections.microsoft?.connected ? (
                    <button
                      onClick={handleDisconnectMicrosoft}
                      disabled={disconnectingProvider === "microsoft" || !isOnline}
                      title={!isOnline ? "You are offline" : undefined}
                      className="w-full mt-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {disconnectingProvider === "microsoft"
                        ? "Disconnecting..."
                        : "Disconnect Outlook"}
                    </button>
                  ) : connections.microsoft?.error && connections.microsoft.error.type !== "NOT_CONNECTED" ? (
                    <button
                      onClick={handleConnectMicrosoft}
                      disabled={connectingProvider === "microsoft" || !isOnline}
                      title={!isOnline ? "You are offline" : undefined}
                      className="w-full mt-2 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connectingProvider === "microsoft"
                        ? "Reconnecting..."
                        : "Reconnect Outlook"}
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectMicrosoft}
                      disabled={connectingProvider === "microsoft" || !isOnline}
                      title={!isOnline ? "You are offline" : undefined}
                      className="w-full mt-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connectingProvider === "microsoft"
                        ? "Connecting..."
                        : "Connect Outlook"}
                    </button>
                  )}
                </div>

                {/* TASK-2072: Email History (cache duration) */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        Email History
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        How much email to keep cached locally for fast search and auto-linking.
                      </p>
                    </div>
                    <select
                      value={emailCacheDurationMonths}
                      onChange={(e) =>
                        handleEmailCacheDurationChange(Number(e.target.value))
                      }
                      disabled={loadingPreferences}
                      className="ml-4 text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value={1}>1 month</option>
                      <option value={3}>3 months</option>
                      <option value={6}>6 months</option>
                      <option value={12}>1 year</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* macOS Messages Import - Only shows on macOS */}
            <div id="settings-messages" className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Messages
              </h3>
              <div className="space-y-4">
                {/* Import Source Selector (macOS only) */}
                <ImportSourceSettings userId={userId} />
                {/* Manual Import Settings */}
                <MacOSMessagesImportSettings userId={userId} />
              </div>
            </div>

            {/* Contacts Import - macOS Contacts + Outlook (TASK-1989) */}
            <div id="settings-contacts" className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Contacts
              </h3>
              <div className="space-y-4">
                <ContactsImportSettings
                  userId={userId}
                  isMicrosoftConnected={connections.microsoft?.connected ?? false}
                  isGoogleConnected={connections.google?.connected ?? false}
                  outlookContactsEnabled={outlookContactsEnabled}
                  macosContactsEnabled={macosContactsEnabled}
                  gmailContactsEnabled={gmailContactsEnabled}
                  outlookEmailsInferred={outlookEmailsInferred}
                  gmailEmailsInferred={gmailEmailsInferred}
                  messagesInferred={messagesInferred}
                  loadingPreferences={loadingPreferences}
                  onToggleSource={(category, key, currentValue) => {
                    const setters: Record<string, React.Dispatch<React.SetStateAction<boolean>>> = {
                      outlookContacts: setOutlookContactsEnabled,
                      macosContacts: setMacosContactsEnabled,
                      gmailContacts: setGmailContactsEnabled,
                      outlookEmails: setOutlookEmailsInferred,
                      gmailEmails: setGmailEmailsInferred,
                      messages: setMessagesInferred,
                    };
                    handleContactSourceToggle(category, key, currentValue, setters[key]);
                  }}
                />
              </div>
            </div>

            {/* Export Settings */}
            {/* AI Settings - Only visible with AI add-on (BACKLOG-462) */}
            <FeatureGate requires="ai_addon">
              <div id="settings-ai" className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  AI Settings
                </h3>
                <div className="space-y-4">
                  {/* TASK-2072: Transaction Detection (smart scan window — read-only) */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        Transaction Detection
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        Scans your email for new transactions since your last scan. First scan covers 1 month.
                      </p>
                    </div>
                    <span className="ml-4 text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1.5 rounded border border-gray-200">
                      Automatic
                    </span>
                  </div>
                  <LLMSettings userId={userId} />
                </div>
              </div>
            </FeatureGate>

            {/* Security */}
            <div id="settings-security" className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Security
              </h3>
              <div className="space-y-3">
                {/* TASK-2045: Sign out all devices */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        Sign Out All Devices
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        Sign out of all active sessions across all your devices
                      </p>
                    </div>
                    <button
                      onClick={handleSignOutAllDevices}
                      disabled={signingOutAllDevices || !isOnline}
                      title={!isOnline ? "You are offline" : undefined}
                      className="ml-4 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {signingOutAllDevices ? "Signing out..." : "Sign Out All Devices"}
                    </button>
                  </div>
                </div>

                {/* TASK-2062: Active Sessions */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        Active Sessions
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        Devices where your account is currently logged in
                      </p>
                    </div>
                    <button
                      onClick={loadActiveDevices}
                      disabled={devicesLoading || !isOnline}
                      title={!isOnline ? "You are offline" : "Refresh device list"}
                      className="px-2 py-1 text-xs font-medium text-gray-600 bg-white hover:bg-gray-100 rounded border border-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {devicesLoading ? "Loading..." : "Refresh"}
                    </button>
                  </div>
                  {devicesLoading && activeDevices.length === 0 ? (
                    <p className="text-xs text-gray-500">Loading devices...</p>
                  ) : activeDevices.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      {isOnline ? "No active sessions found." : "Go online to view active sessions."}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {activeDevices.map((device) => (
                        <div
                          key={device.device_id}
                          className={`p-3 rounded border text-xs ${
                            device.isCurrentDevice
                              ? "bg-blue-50 border-blue-200"
                              : "bg-white border-gray-100"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {/* Device icon */}
                              <svg
                                className="w-4 h-4 text-gray-400 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                              </svg>
                              <span className="font-medium text-gray-800">
                                {device.device_name || "Unknown device"}
                              </span>
                              {device.isCurrentDevice && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
                                  This device
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-gray-500 ml-6">
                            <span>{device.os || device.platform}</span>
                            <span className="text-gray-300">|</span>
                            <span>
                              {formatRelativeTime(device.last_seen_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Data & Privacy */}
            <div id="settings-data" className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Data & Privacy
              </h3>
              <div className="space-y-3">
                {/* Reindex Database - Database maintenance for performance */}
                <button
                  onClick={handleReindexDatabase}
                  disabled={reindexing || reindexRunning}
                  className="w-full text-left p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        Reindex Database
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        Optimize database performance if you notice slowness
                      </p>
                      {/* Show result message */}
                      {reindexResult && (
                        <p
                          className={`text-xs mt-2 ${
                            reindexResult.success
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {reindexResult.message}
                        </p>
                      )}
                    </div>
                    {(reindexing || reindexRunning) ? (
                      <svg
                        className="w-5 h-5 text-blue-500 animate-spin"
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
                    ) : (
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    )}
                  </div>
                </button>

                {/* TASK-2052: Database Backup & Restore */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-1">
                    Database Backup & Restore
                  </h4>
                  <p className="text-xs text-gray-600 mb-2">
                    Your database is encrypted and stored locally. Backups can be
                    used to recover data if something goes wrong.
                  </p>
                  {dbInfo && (
                    <div className="text-xs text-gray-500 mb-3 space-y-0.5">
                      <p>Database size: {formatFileSize(dbInfo.fileSize)}</p>
                      <p>
                        Last modified:{" "}
                        {new Date(dbInfo.lastModified).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleBackupDatabase}
                      disabled={backingUp || restoring || backupRunning || restoreRunning}
                      className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {(backingUp || backupRunning) ? "Backing up..." : "Backup Database"}
                    </button>
                    <button
                      onClick={handleRestoreDatabase}
                      disabled={backingUp || restoring || backupRunning || restoreRunning}
                      className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {(restoring || restoreRunning) ? "Restoring..." : "Restore from Backup"}
                    </button>
                  </div>
                  {backupResult && (
                    <p
                      className={`text-xs mt-2 ${
                        backupResult.success
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {backupResult.message}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Backups are encrypted with your machine&apos;s keychain.
                    They can only be restored on this machine.
                  </p>
                </div>

                {/* TASK-2058: Diagnostic Log for offline failure tracking */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        Diagnostic Log
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        Recent network operation failures (for support diagnostics)
                      </p>
                    </div>
                    {failureLogEntries.length > 0 && (
                      <button
                        onClick={handleClearFailureLog}
                        className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors"
                      >
                        Clear Log
                      </button>
                    )}
                  </div>
                  {failureLogLoading ? (
                    <p className="text-xs text-gray-500">Loading...</p>
                  ) : failureLogEntries.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No failures recorded.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-2 mt-2">
                      {failureLogEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="p-2 bg-white rounded border border-gray-100 text-xs"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-medium text-gray-800">
                              {OPERATION_LABELS[entry.operation] || entry.operation}
                            </span>
                            <span className="text-gray-400 text-[10px]">
                              {new Date(entry.timestamp + "Z").toLocaleString()}
                            </span>
                          </div>
                          <p className="text-gray-600 break-words">
                            {entry.error_message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* CCPA Data Export (TASK-2053) - moved from Privacy tab */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Export Your Data (CCPA)
                  </h4>
                  <p className="text-xs text-gray-600 mb-3">
                    You have the right to know what personal data is stored in this
                    application. Click below to export all your data as a JSON file.
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    Data included: profile, transactions, contacts, messages, emails,
                    preferences, and activity logs. OAuth token values are excluded
                    for security.
                  </p>
                  {(exporting || exportRunning) && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>
                          Exporting{(exportCategory || orchestratorExportCategory) ? `: ${exportCategory || orchestratorExportCategory}` : "..."}
                        </span>
                        <span>{exportProgress || orchestratorExportProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${exportProgress || orchestratorExportProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {exportResult && (
                    <p
                      className={`text-xs mb-3 ${
                        exportResult.success ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {exportResult.message}
                    </p>
                  )}
                  <button
                    onClick={handleExportData}
                    disabled={exporting || exportRunning}
                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {(exporting || exportRunning) ? "Exporting..." : "Export My Data"}
                  </button>
                </div>

                {/* TODO: Implement data clearing with confirmation dialog */}
                <button
                  disabled
                  className="w-full text-left p-4 bg-red-50 rounded-lg border border-red-200 opacity-50 cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-red-700">
                        Clear All Data
                      </h4>
                      <p className="text-xs text-red-600 mt-1">
                        Delete all local data and reset the app
                      </p>
                    </div>
                    <svg
                      className="w-5 h-5 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </div>
                </button>
              </div>
            </div>

            {/* About */}
            <div id="settings-about">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                About
              </h3>
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                <div className="space-y-2 text-xs">
                  <button
                    onClick={() => window.open("https://github.com/5hdaniel/Mad/releases", "_blank")}
                    className="w-full text-left text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  >
                    View Release Notes
                  </button>
                  <button
                    onClick={() => window.open("https://www.keeprcompliance.com/legal#privacy", "_blank")}
                    className="w-full text-left text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                  <button
                    onClick={() => window.open("https://www.keeprcompliance.com/legal#terms", "_blank")}
                    className="w-full text-left text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  >
                    Terms of Service
                  </button>
                </div>
                {/* TASK-2180: Contact Support */}
                <button
                  onClick={handleContactSupport}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  Contact Support
                </button>
                <p className="mt-3 text-xs text-gray-500">
                  &copy; 2026 Blue Spaces LLC. All rights reserved.
                </p>
              </div>
            </div>
          </>
          )}
          </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-xl">
          <button
            onClick={onClose}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-all"
          >
            Done
          </button>
        </div>
      </div>

      {/* TASK-2180: Support Ticket Dialog */}
      {showSupportDialog && (
        <SupportTicketDialog
          onClose={() => setShowSupportDialog(false)}
          userEmail={supportUserEmail}
          userName={supportUserName}
        />
      )}
    </div>
  );
}

export default Settings;
