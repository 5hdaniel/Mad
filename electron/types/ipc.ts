/**
 * IPC (Inter-Process Communication) Types for Magic Audit
 * These types define type-safe communication between main and renderer processes
 */

import type {
  User,
  Contact,
  Transaction,
  Communication,
  UserFeedback,
  TransactionFilters,
  CommunicationFilters,
  ContactFilters,
  NewContact,
  NewTransaction,
  OAuthProvider,
  ExportFormat,
  Subscription,
  UserLicense,
} from "./models";
import type { ExportResult, ExtractionResult, SyncStatus } from "./database";

// ============================================
// LLM TYPE DEFINITIONS
// ============================================

/**
 * LLM provider type
 */
export type LLMProvider = "openai" | "anthropic";

/**
 * Response wrapper for consistent error handling across all LLM handlers.
 */
export interface LLMHandlerResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    type: string;
    retryable: boolean;
  };
}

/**
 * User-facing LLM configuration summary.
 * Never exposes raw API keys or sensitive settings.
 */
export interface LLMUserConfig {
  hasOpenAI: boolean;
  hasAnthropic: boolean;
  preferredProvider: LLMProvider;
  openAIModel: string;
  anthropicModel: string;
  tokensUsed: number;
  budgetLimit?: number;
  platformAllowanceRemaining: number;
  usePlatformAllowance: boolean;
  autoDetectEnabled: boolean;
  roleExtractionEnabled: boolean;
  hasConsent: boolean;
}

/**
 * Preferences that can be updated by the user.
 */
export interface LLMPreferences {
  preferredProvider?: LLMProvider;
  openAIModel?: string;
  anthropicModel?: string;
  enableAutoDetect?: boolean;
  enableRoleExtraction?: boolean;
  usePlatformAllowance?: boolean;
  budgetLimit?: number;
}

/**
 * Usage statistics for display.
 */
export interface LLMUsageStats {
  tokensThisMonth: number;
  budgetLimit?: number;
  budgetRemaining?: number;
  platformAllowance: number;
  platformUsed: number;
  resetDate?: string;
}

/**
 * Result of canUseLLM check.
 */
export interface LLMAvailability {
  canUse: boolean;
  reason?: string;
}

// ============================================
// SHARED IPC TYPES
// ============================================

/**
 * Export progress event data
 */
export interface ExportProgress {
  current: number;
  total: number;
  contactName?: string;
  phase?: "preparing" | "exporting" | "finishing";
}

/**
 * Auto-update info
 */
export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

/**
 * Download progress info
 */
export interface UpdateProgress {
  percent: number;
  bytesPerSecond?: number;
  total?: number;
  transferred?: number;
}

/**
 * Conversation summary for iMessage/SMS
 */
export interface ConversationSummary {
  id: string;
  name: string;
  directChatCount: number;
  groupChatCount: number;
  directMessageCount: number;
  groupMessageCount: number;
  lastMessageDate: Date;
}

/**
 * Message attachment info for display (TASK-1012)
 */
export interface MessageAttachmentInfo {
  id: string;
  message_id: string;
  filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  /** Base64-encoded file content for inline display */
  data: string | null;
}

// ============================================
// IPC CHANNEL DEFINITIONS
// ============================================

/**
 * Type-safe IPC channel definitions
 * Format: { 'channel:name': { request: RequestType, response: ResponseType } }
 */
export interface IpcChannels {
  // ============================================
  // AUTHENTICATION CHANNELS
  // ============================================
  "auth:login": {
    request: { provider: OAuthProvider };
    response: { success: boolean; user?: User; error?: string };
  };
  "auth:logout": {
    request: { userId: string };
    response: { success: boolean };
  };
  "auth:get-current-user": {
    request: void;
    response: User | null;
  };
  "auth:refresh-token": {
    request: { provider: OAuthProvider };
    response: { success: boolean; error?: string };
  };

  // ============================================
  // TRANSACTION CHANNELS
  // ============================================
  "transactions:get-all": {
    request: { userId: string; filters?: TransactionFilters };
    response: Transaction[];
  };
  "transactions:get-by-id": {
    request: { transactionId: string };
    response: Transaction | null;
  };
  "transactions:create": {
    request: { userId: string; transactionData: NewTransaction };
    response: Transaction;
  };
  "transactions:update": {
    request: { transactionId: string; updates: Partial<Transaction> };
    response: { success: boolean };
  };
  "transactions:delete": {
    request: { transactionId: string };
    response: { success: boolean };
  };
  "transactions:extract-data": {
    request: { transactionId: string };
    response: ExtractionResult;
  };
  "transactions:export": {
    request: {
      transactionId: string;
      format: ExportFormat;
      options?: {
        includeAttachments?: boolean;
        includeEmails?: boolean;
        includeTexts?: boolean;
      };
    };
    response: ExportResult;
  };
  "transactions:link-contact": {
    request: { transactionId: string; contactId: string; role?: string };
    response: { success: boolean };
  };
  "transactions:unlink-contact": {
    request: { transactionId: string; contactId: string };
    response: { success: boolean };
  };

  // ============================================
  // CONTACT CHANNELS
  // ============================================
  "contacts:get-all": {
    request: { userId: string; filters?: ContactFilters };
    response: Contact[];
  };
  "contacts:get-available": {
    request: { userId: string };
    response: Contact[];
  };
  "contacts:get-sorted-by-activity": {
    request: { userId: string; propertyAddress?: string };
    response: Contact[];
  };
  "contacts:create": {
    request: { userId: string; contactData: NewContact };
    response: Contact;
  };
  "contacts:update": {
    request: { contactId: string; updates: Partial<Contact> };
    response: { success: boolean };
  };
  "contacts:delete": {
    request: { contactId: string };
    response: { success: boolean };
  };
  "contacts:remove": {
    request: { contactId: string };
    response: { success: boolean };
  };
  "contacts:checkCanDelete": {
    request: { contactId: string };
    response: { canDelete: boolean; linkedTransactions: number };
  };
  "contacts:import": {
    request: { userId: string; contactsToImport: NewContact[] };
    response: { success: boolean; contacts?: Contact[]; error?: string };
  };

  // ============================================
  // COMMUNICATION CHANNELS
  // ============================================
  "communications:get-by-transaction": {
    request: { transactionId: string };
    response: Communication[];
  };
  "communications:get-all": {
    request: { userId: string; filters?: CommunicationFilters };
    response: Communication[];
  };
  "communications:sync": {
    request: { userId: string; provider: OAuthProvider };
    response: SyncStatus;
  };

  // ============================================
  // FEEDBACK CHANNELS
  // ============================================
  "feedback:submit": {
    request: {
      userId: string;
      feedbackData: Omit<UserFeedback, "id" | "created_at" | "user_id">;
    };
    response: { success: boolean };
  };
  "feedback:get-for-transaction": {
    request: { transactionId: string };
    response: UserFeedback[];
  };
  "feedback:get-metrics": {
    request: { userId: string; fieldName?: string };
    response: {
      totalFeedback: number;
      confirmations: number;
      corrections: number;
      rejections: number;
      accuracyRate: number;
    };
  };
  "feedback:get-suggestion": {
    request: {
      userId: string;
      fieldName: string;
      extractedValue: string;
      confidence: number;
    };
    response: {
      shouldShowWarning: boolean;
      suggestedValue?: string;
      reason?: string;
    };
  };
  "feedback:get-learning-stats": {
    request: { userId: string; fieldName: string };
    response: {
      totalSamples: number;
      averageAccuracy: number;
      commonCorrections: Array<{ from: string; to: string; count: number }>;
    };
  };

  // ============================================
  // SYSTEM CHANNELS
  // ============================================
  "system:run-permission-setup": {
    request: void;
    response: { success: boolean };
  };
  "system:request-contacts-permission": {
    request: void;
    response: { granted: boolean };
  };
  "system:setup-full-disk-access": {
    request: void;
    response: { success: boolean };
  };
  "system:open-privacy-pane": {
    request: { pane: string };
    response: { success: boolean };
  };
  "system:check-full-disk-access-status": {
    request: void;
    response: { hasAccess: boolean };
  };
  "system:check-full-disk-access": {
    request: void;
    response: { hasAccess: boolean };
  };
  "system:check-contacts-permission": {
    request: void;
    response: { hasPermission: boolean };
  };
  "system:check-all-permissions": {
    request: void;
    response: {
      allGranted: boolean;
      permissions: {
        fullDiskAccess?: { hasPermission: boolean; error?: string };
        contacts?: { hasPermission: boolean; error?: string };
      };
      errors: Array<{ hasPermission: boolean; error?: string }>;
    };
  };
  "system:check-google-connection": {
    request: { userId: string };
    response: {
      connected: boolean;
      email?: string;
      error?: string;
    };
  };
  "system:check-microsoft-connection": {
    request: { userId: string };
    response: {
      connected: boolean;
      email?: string;
      error?: string;
    };
  };
  "system:check-all-connections": {
    request: { userId: string };
    response: {
      google: { connected: boolean; email?: string };
      microsoft: { connected: boolean; email?: string };
    };
  };
  "system:health-check": {
    request: { userId: string; provider?: OAuthProvider };
    response: {
      healthy: boolean;
      provider?: OAuthProvider;
      issues?: string[];
    };
  };

  // ============================================
  // ADDRESS CHANNELS
  // ============================================
  "address:initialize": {
    request: { apiKey: string };
    response: { success: boolean };
  };
  "address:get-suggestions": {
    request: { input: string; sessionToken: string };
    response: Array<{
      description: string;
      placeId: string;
    }>;
  };
  "address:get-details": {
    request: { placeId: string };
    response: {
      address: string;
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      coordinates?: { lat: number; lng: number };
    };
  };
  "address:geocode": {
    request: { address: string };
    response: {
      lat: number;
      lng: number;
      formattedAddress: string;
    };
  };

  // ============================================
  // PREFERENCE CHANNELS
  // ============================================
  "preferences:get": {
    request: { userId: string };
    response: Record<string, unknown>;
  };
  "preferences:set": {
    request: { userId: string; key: string; value: unknown };
    response: { success: boolean };
  };
  "preferences:reset": {
    request: { userId: string };
    response: { success: boolean };
  };
}

// ============================================
// TYPE HELPERS
// ============================================

/**
 * Extract request type for a channel
 */
export type IpcRequest<T extends keyof IpcChannels> = IpcChannels[T]["request"];

/**
 * Extract response type for a channel
 */
export type IpcResponse<T extends keyof IpcChannels> =
  IpcChannels[T]["response"];

/**
 * Type-safe IPC handler function
 */
export type IpcHandler<T extends keyof IpcChannels> = (
  event: Electron.IpcMainInvokeEvent,
  ...args: IpcRequest<T> extends void ? [] : [IpcRequest<T>]
) => Promise<IpcResponse<T>> | IpcResponse<T>;

/**
 * Type-safe IPC invoke function (for renderer)
 */
export type IpcInvoke = <T extends keyof IpcChannels>(
  channel: T,
  ...args: IpcRequest<T> extends void ? [] : [IpcRequest<T>]
) => Promise<IpcResponse<T>>;

// ============================================
// IPC RESULT TYPE GUARDS
// ============================================

/**
 * Generic IPC result interface for consistent response handling
 */
export interface IpcResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Type guard to check if an IPC result is successful
 */
export function isIpcSuccess<T>(
  result: IpcResult<T>,
): result is IpcResult<T> & { success: true; data: T } {
  return result.success === true && result.data !== undefined;
}

/**
 * Type guard to check if an IPC result has an error
 */
export function isIpcError<T>(
  result: IpcResult<T>,
): result is IpcResult<T> & { success: false; error: string } {
  return result.success === false && typeof result.error === "string";
}

/**
 * Type guard for WindowApi result patterns (success + optional data)
 */
export function hasSuccessResult(
  result: unknown,
): result is { success: boolean; error?: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    "success" in result &&
    typeof (result as { success: unknown }).success === "boolean"
  );
}

/**
 * Type guard for transaction results
 */
export function isTransactionResult(
  result: unknown,
): result is { success: boolean; transaction?: Transaction; error?: string } {
  if (!hasSuccessResult(result)) return false;
  const r = result as { transaction?: unknown };
  return r.transaction === undefined || typeof r.transaction === "object";
}

/**
 * Type guard for contact results
 */
export function isContactResult(
  result: unknown,
): result is { success: boolean; contact?: Contact; error?: string } {
  if (!hasSuccessResult(result)) return false;
  const r = result as { contact?: unknown };
  return r.contact === undefined || typeof r.contact === "object";
}

/**
 * Type guard for contacts array results
 */
export function isContactsResult(
  result: unknown,
): result is { success: boolean; contacts?: Contact[]; error?: string } {
  if (!hasSuccessResult(result)) return false;
  const r = result as { contacts?: unknown };
  return r.contacts === undefined || Array.isArray(r.contacts);
}

// ============================================
// WINDOW API (exposed via preload)
// ============================================

/**
 * Window API exposed to renderer process via contextBridge
 */
export interface WindowApi {
  // IPC invoke
  invoke: IpcInvoke;

  // Event listeners
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  off: (channel: string, callback: (...args: unknown[]) => void) => void;
  once: (channel: string, callback: (...args: unknown[]) => void) => void;

  // Platform info
  platform: NodeJS.Platform;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };

  // Auth methods
  auth: {
    googleLogin: () => Promise<{
      success: boolean;
      authUrl?: string;
      error?: string;
    }>;
    googleCompleteLogin: (code: string) => Promise<{
      success: boolean;
      user?: User;
      sessionToken?: string;
      subscription?: Subscription;
      isNewUser?: boolean;
      error?: string;
    }>;
    microsoftLogin: () => Promise<{
      success: boolean;
      authUrl?: string;
      error?: string;
    }>;
    microsoftCompleteLogin: (code: string) => Promise<{
      success: boolean;
      user?: User;
      sessionToken?: string;
      subscription?: Subscription;
      isNewUser?: boolean;
      error?: string;
    }>;
    googleConnectMailbox: (
      userId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    microsoftConnectMailbox: (
      userId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    googleDisconnectMailbox: (
      userId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    microsoftDisconnectMailbox: (
      userId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    logout: (
      sessionToken: string,
    ) => Promise<{ success: boolean; error?: string }>;
    forceLogout: () => Promise<{ success: boolean; error?: string }>;
    validateSession: (
      sessionToken: string,
    ) => Promise<{ valid: boolean; user?: User; error?: string }>;
    getCurrentUser: () => Promise<{
      success: boolean;
      user?: User;
      sessionToken?: string;
      subscription?: Subscription;
      provider?: string;
      isNewUser?: boolean;
      error?: string;
    }>;
    acceptTerms: (
      userId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    completeEmailOnboarding: (
      userId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    checkEmailOnboarding: (
      userId: string,
    ) => Promise<{ success: boolean; completed: boolean; error?: string }>;
    // Complete pending login after keychain setup (login-first flow)
    completePendingLogin: (oauthData: unknown) => Promise<{
      success: boolean;
      user?: User;
      sessionToken?: string;
      subscription?: Subscription;
      isNewUser?: boolean;
      error?: string;
    }>;
    // Pre-DB mailbox connection (returns tokens instead of saving to DB)
    googleConnectMailboxPending: (
      emailHint?: string,
    ) => Promise<{ success: boolean; error?: string }>;
    microsoftConnectMailboxPending: (
      emailHint?: string,
    ) => Promise<{ success: boolean; error?: string }>;
    // Save pending mailbox tokens after DB initialization
    savePendingMailboxTokens: (data: {
      userId: string;
      provider: "google" | "microsoft";
      email: string;
      tokens: {
        access_token: string;
        refresh_token: string | null;
        expires_at: string;
        scopes: string;
      };
    }) => Promise<{ success: boolean; error?: string }>;

    // TASK-1507: Deep link browser auth
    /**
     * Opens Supabase auth URL in the default browser
     * Used for deep-link authentication flow
     */
    openAuthInBrowser: () => Promise<{ success: boolean; error?: string }>;
  };

  // System methods
  system: {
    // Platform detection (migrated from window.electron.platform)
    platform: NodeJS.Platform;

    // App info methods (migrated from window.electron)
    getAppInfo: () => Promise<{ version: string; name: string }>;
    getMacOSVersion: () => Promise<{ version: string | number; name?: string }>;
    checkAppLocation: () => Promise<{
      inApplications?: boolean;
      shouldPrompt?: boolean;
      appPath?: string;
      path?: string;
    }>;

    // Permission checks (migrated from window.electron)
    checkPermissions: () => Promise<{
      hasPermission?: boolean;
      fullDiskAccess?: boolean;
      contacts?: boolean;
    }>;
    triggerFullDiskAccess: () => Promise<{ granted: boolean }>;
    requestPermissions: () => Promise<Record<string, unknown>>;
    openSystemSettings: () => Promise<{ success: boolean }>;

    // Existing system methods
    runPermissionSetup: () => Promise<{ success: boolean }>;
    requestContactsPermission: () => Promise<{ granted: boolean }>;
    setupFullDiskAccess: () => Promise<{ success: boolean }>;
    openPrivacyPane: (pane: string) => Promise<{ success: boolean }>;
    checkFullDiskAccessStatus: () => Promise<{ hasAccess: boolean }>;
    checkFullDiskAccess: () => Promise<{ hasAccess: boolean }>;
    checkContactsPermission: () => Promise<{ hasPermission: boolean }>;
    checkAllPermissions: () => Promise<{
      allGranted: boolean;
      permissions: {
        fullDiskAccess?: { hasPermission: boolean; error?: string };
        contacts?: { hasPermission: boolean; error?: string };
      };
      errors: Array<{ hasPermission: boolean; error?: string }>;
    }>;
    checkGoogleConnection: (
      userId: string,
    ) => Promise<{ connected: boolean; email?: string; error?: string }>;
    checkMicrosoftConnection: (
      userId: string,
    ) => Promise<{ connected: boolean; email?: string; error?: string }>;
    checkAllConnections: (userId: string) => Promise<{
      success: boolean;
      google?: {
        connected: boolean;
        email?: string;
        error?: {
          type: string;
          userMessage: string;
          action?: string;
          actionHandler?: string;
        } | null;
      };
      microsoft?: {
        connected: boolean;
        email?: string;
        error?: {
          type: string;
          userMessage: string;
          action?: string;
          actionHandler?: string;
        } | null;
      };
    }>;
    healthCheck: (
      userId: string,
      provider: OAuthProvider,
    ) => Promise<{
      healthy: boolean;
      provider?: OAuthProvider;
      issues?: string[];
    }>;
    // Secure storage / keychain methods
    getSecureStorageStatus: () => Promise<{
      success: boolean;
      available: boolean;
      platform?: string;
      guidance?: string;
      error?: string;
    }>;
    initializeSecureStorage: () => Promise<{
      success: boolean;
      available: boolean;
      platform?: string;
      guidance?: string;
      error?: string;
    }>;
    hasEncryptionKeyStore: () => Promise<{
      success: boolean;
      hasKeyStore: boolean;
    }>;
    initializeDatabase: () => Promise<{ success: boolean; error?: string }>;
    isDatabaseInitialized: () => Promise<{
      success: boolean;
      initialized: boolean;
    }>;
    // Support methods
    contactSupport: (
      errorDetails?: string,
    ) => Promise<{ success: boolean; error?: string }>;
    getDiagnostics: () => Promise<{
      success: boolean;
      diagnostics?: string;
      error?: string;
    }>;
    // Database maintenance methods
    reindexDatabase: () => Promise<{
      success: boolean;
      indexesRebuilt?: number;
      durationMs?: number;
      error?: string;
    }>;
  };

  // Preferences methods
  preferences: {
    get: (
      userId: string,
    ) => Promise<{ success: boolean; preferences?: Record<string, unknown> }>;
    save: (
      userId: string,
      preferences: Record<string, unknown>,
    ) => Promise<{ success: boolean }>;
    update: (
      userId: string,
      partialPreferences: Record<string, unknown>,
    ) => Promise<{ success: boolean }>;
  };

  // LLM methods
  llm: {
    getConfig: (userId: string) => Promise<LLMHandlerResponse<LLMUserConfig>>;
    setApiKey: (
      userId: string,
      provider: LLMProvider,
      apiKey: string,
    ) => Promise<LLMHandlerResponse<void>>;
    validateKey: (
      provider: LLMProvider,
      apiKey: string,
    ) => Promise<LLMHandlerResponse<boolean>>;
    removeApiKey: (
      userId: string,
      provider: LLMProvider,
    ) => Promise<LLMHandlerResponse<void>>;
    updatePreferences: (
      userId: string,
      preferences: LLMPreferences,
    ) => Promise<LLMHandlerResponse<void>>;
    recordConsent: (
      userId: string,
      consent: boolean,
    ) => Promise<LLMHandlerResponse<void>>;
    getUsage: (userId: string) => Promise<LLMHandlerResponse<LLMUsageStats>>;
    canUse: (userId: string) => Promise<LLMHandlerResponse<LLMAvailability>>;
  };

  // Feedback methods for AI transaction detection
  feedback: {
    submit: (
      userId: string,
      feedbackData: Record<string, unknown>,
    ) => Promise<{ success: boolean; feedbackId?: string; error?: string }>;
    getForTransaction: (
      transactionId: string,
    ) => Promise<{ success: boolean; feedback?: unknown[]; error?: string }>;
    getMetrics: (
      userId: string,
      fieldName: string,
    ) => Promise<{ success: boolean; metrics?: unknown; error?: string }>;
    getSuggestion: (
      userId: string,
      fieldName: string,
      extractedValue: unknown,
      confidence: number,
    ) => Promise<{ success: boolean; suggestion?: unknown; confidence?: number; error?: string }>;
    getLearningStats: (
      userId: string,
      fieldName: string,
    ) => Promise<{ success: boolean; stats?: unknown; error?: string }>;
    recordTransaction: (
      userId: string,
      feedback: {
        detectedTransactionId: string;
        action: "confirm" | "reject" | "merge";
        corrections?: {
          propertyAddress?: string;
          transactionType?: string;
          addCommunications?: string[];
          removeCommunications?: string[];
          reason?: string;
        };
        modelVersion?: string;
        promptVersion?: string;
      },
    ) => Promise<{ success: boolean; error?: string }>;
    recordRole: (
      userId: string,
      feedback: {
        transactionId: string;
        contactId: string;
        originalRole: string;
        correctedRole: string;
        modelVersion?: string;
        promptVersion?: string;
      },
    ) => Promise<{ success: boolean; error?: string }>;
    recordRelevance: (
      userId: string,
      feedback: {
        communicationId: string;
        wasRelevant: boolean;
        correctTransactionId?: string;
        modelVersion?: string;
        promptVersion?: string;
      },
    ) => Promise<{ success: boolean; error?: string }>;
    getStats: (
      userId: string,
    ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  };

  // User preference methods (stored in local database)
  user: {
    getPhoneType: (userId: string) => Promise<{
      success: boolean;
      phoneType: "iphone" | "android" | null;
      error?: string;
    }>;
    setPhoneType: (
      userId: string,
      phoneType: "iphone" | "android",
    ) => Promise<{ success: boolean; error?: string }>;
  };

  // Contact methods
  contacts: {
    getAll: (
      userId: string,
    ) => Promise<{ success: boolean; contacts?: Contact[]; error?: string }>;
    getSortedByActivity: (
      userId: string,
      propertyAddress?: string,
    ) => Promise<{ success: boolean; contacts?: Contact[]; error?: string }>;
    getAvailable: (
      userId: string,
    ) => Promise<{ success: boolean; contacts?: Contact[]; error?: string }>;
    checkCanDelete: (contactId: string) => Promise<{
      canDelete: boolean;
      transactionCount?: number;
      error?: string;
    }>;
    create: (
      userId: string,
      contactData: Record<string, unknown>,
    ) => Promise<{ success: boolean; contact?: Contact; error?: string }>;
    update: (
      contactId: string,
      updates: Record<string, unknown>,
    ) => Promise<{ success: boolean; error?: string }>;
    delete: (
      contactId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    remove: (
      contactId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    import: (
      userId: string,
      contacts: NewContact[],
    ) => Promise<{ success: boolean; imported?: number; error?: string }>;
    /** Listen for import progress updates */
    onImportProgress: (
      callback: (progress: { current: number; total: number; percent: number }) => void
    ) => () => void;
    /**
     * Sync external contacts from macOS Contacts app
     * @param userId - User ID to sync contacts for
     * @returns Sync result with inserted/deleted/total counts
     */
    syncExternal: (userId: string) => Promise<{
      success: boolean;
      inserted?: number;
      deleted?: number;
      total?: number;
      error?: string;
    }>;
    /**
     * Get external contacts sync status
     * @param userId - User ID to check status for
     * @returns Sync status (lastSyncAt, isStale, contactCount)
     */
    getExternalSyncStatus: (userId: string) => Promise<{
      success: boolean;
      lastSyncAt?: string | null;
      isStale?: boolean;
      contactCount?: number;
      error?: string;
    }>;
  };

  // Transaction methods
  transactions: {
    getAll: (userId: string) => Promise<{
      success: boolean;
      transactions?: Transaction[];
      error?: string;
    }>;
    scan: (
      userId: string,
      options?: Record<string, unknown>,
    ) => Promise<{
      success: boolean;
      transactions?: Transaction[];
      transactionsFound?: number;
      emailsScanned?: number;
      error?: string;
    }>;
    cancelScan: (
      userId: string,
    ) => Promise<{ success: boolean; cancelled?: boolean; error?: string }>;
    getDetails: (
      transactionId: string,
    ) => Promise<{
      success: boolean;
      transaction?: Transaction & {
        communications?: Communication[];
        contact_assignments?: Array<{
          id: string;
          contact_id: string;
          contact_name?: string;
          contact_email?: string;
          contact_phone?: string;
          contact_company?: string;
          role?: string;
          specific_role?: string;
          is_primary?: number;
          notes?: string;
        }>;
      };
      error?: string;
    }>;
    create: (
      userId: string,
      transactionData: Record<string, unknown>,
    ) => Promise<{
      success: boolean;
      transaction?: Transaction;
      error?: string;
    }>;
    createAudited: (
      userId: string,
      transactionData: Record<string, unknown>,
    ) => Promise<{
      success: boolean;
      transaction?: Transaction;
      error?: string;
    }>;
    update: (
      transactionId: string,
      data: Record<string, unknown>,
    ) => Promise<{ success: boolean; error?: string }>;
    delete: (
      transactionId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    exportEnhanced: (
      transactionId: string,
      options?: {
        exportFormat?: string;
        contentType?: "text" | "email" | "both";
        startDate?: string;
        endDate?: string;
      },
    ) => Promise<{ success: boolean; path?: string; error?: string }>;
    assignContact: (
      transactionId: string,
      contactId: string,
      role: string,
      roleCategory?: string,
      isPrimary?: boolean,
      notes?: string,
    ) => Promise<{ success: boolean; error?: string }>;
    removeContact: (
      transactionId: string,
      contactId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    batchUpdateContacts: (
      transactionId: string,
      operations: Array<{
        action: "add" | "remove";
        contactId: string;
        role?: string;
        roleCategory?: string;
        specificRole?: string;
        isPrimary?: boolean;
        notes?: string;
      }>,
    ) => Promise<{
      success: boolean;
      error?: string;
      autoLinkResults?: Array<{
        contactId: string;
        emailsLinked: number;
        messagesLinked: number;
        alreadyLinked: number;
        errors: number;
      }>;
    }>;
    unlinkCommunication: (
      communicationId: string,
      reason?: string,
    ) => Promise<{ success: boolean; error?: string }>;
    bulkDelete: (
      transactionIds: string[],
    ) => Promise<{
      success: boolean;
      deletedCount?: number;
      errors?: string[];
      error?: string;
    }>;
    bulkUpdateStatus: (
      transactionIds: string[],
      status: "pending" | "active" | "closed" | "rejected",
    ) => Promise<{
      success: boolean;
      updatedCount?: number;
      errors?: string[];
      error?: string;
    }>;

    // ============================================
    // SUBMISSION METHODS (BACKLOG-391)
    // ============================================

    /**
     * Submit transaction to broker portal for review
     */
    submit: (transactionId: string) => Promise<{
      success: boolean;
      submissionId?: string;
      messagesCount?: number;
      attachmentsCount?: number;
      attachmentsFailed?: number;
      error?: string;
    }>;

    /**
     * Resubmit transaction (creates new version)
     */
    resubmit: (transactionId: string) => Promise<{
      success: boolean;
      submissionId?: string;
      messagesCount?: number;
      attachmentsCount?: number;
      attachmentsFailed?: number;
      error?: string;
    }>;

    /**
     * Get submission status from cloud
     */
    getSubmissionStatus: (submissionId: string) => Promise<{
      success: boolean;
      status?: string;
      reviewNotes?: string;
      reviewedBy?: string;
      reviewedAt?: string;
      error?: string;
    }>;

    /**
     * Listen for submission progress updates
     */
    onSubmitProgress: (callback: (progress: {
      stage: string;
      stageProgress: number;
      overallProgress: number;
      currentItem?: string;
    }) => void) => () => void;
  };

  // Address lookup methods
  address: {
    initialize: (
      apiKey: string,
    ) => Promise<{ success: boolean; error?: string }>;
    getSuggestions: (
      input: string,
      sessionToken?: string,
    ) => Promise<{
      success: boolean;
      suggestions?: Array<{ description: string; placeId: string }>;
      error?: string;
    }>;
    getDetails: (placeId: string) => Promise<{
      success: boolean;
      address?: {
        formatted_address?: string;
        street?: string;
        city?: string;
        state?: string;
        state_short?: string;
        zip?: string;
        coordinates?: { lat: number; lng: number };
      };
      formatted_address?: string;
      street?: string;
      city?: string;
      state?: string;
      state_short?: string;
      zip?: string;
      coordinates?: { lat: number; lng: number };
      error?: string;
    }>;
    geocode: (
      address: string,
    ) => Promise<{ lat: number; lng: number; formattedAddress: string }>;
  };

  // Shell methods
  shell: {
    openExternal: (url: string) => Promise<void>;
    openPopup: (url: string, title?: string) => Promise<{ success: boolean }>;
    openFolder: (folderPath: string) => Promise<{ success: boolean }>;
  };

  // OS Notifications
  notification: {
    /** Check if notifications are supported on this platform */
    isSupported: () => Promise<{ success: boolean; supported: boolean }>;
    /** Send an OS notification */
    send: (title: string, body: string) => Promise<{ success: boolean; error?: string }>;
  };

  // Messages API (iMessage/SMS - migrated from window.electron)
  messages: {
    getConversations: () => Promise<{
      success: boolean;
      conversations?: ConversationSummary[];
      error?: string;
    }>;
    getMessages: (chatId: string) => Promise<unknown[]>;
    exportConversations: (
      conversationIds: string[],
    ) => Promise<{
      success: boolean;
      exportPath?: string;
      canceled?: boolean;
      error?: string;
    }>;
    /** Import messages from macOS Messages app into the app database (macOS only) */
    importMacOSMessages: (userId: string) => Promise<{
      success: boolean;
      messagesImported: number;
      messagesSkipped: number;
      attachmentsImported: number;
      attachmentsSkipped: number;
      duration: number;
      error?: string;
    }>;
    /** Get count of messages available for import from macOS Messages */
    getImportCount: () => Promise<{ success: boolean; count?: number; error?: string }>;
    /** Listen for import progress updates */
    onImportProgress: (callback: (progress: { phase: "deleting" | "importing" | "attachments"; current: number; total: number; percent: number }) => void) => () => void;
    /** Get attachments for a message with base64 data (TASK-1012) */
    getMessageAttachments: (messageId: string) => Promise<MessageAttachmentInfo[]>;
    /** Get attachments for multiple messages at once (TASK-1012) */
    getMessageAttachmentsBatch: (messageIds: string[]) => Promise<Record<string, MessageAttachmentInfo[]>>;
    /** Repair attachment message_id mappings without full re-import */
    repairAttachments: () => Promise<{
      total: number;
      repaired: number;
      orphaned: number;
      alreadyCorrect: number;
    }>;
    /** Get macOS messages import status (count and last import time) */
    getImportStatus: (userId: string) => Promise<{
      success: boolean;
      messageCount?: number;
      lastImportAt?: string | null;
      error?: string;
    }>;
  };

  // Outlook integration (migrated from window.electron)
  outlook: {
    initialize: () => Promise<{ success: boolean; error?: string }>;
    authenticate: () => Promise<{
      success: boolean;
      error?: string;
      userInfo?: { username?: string };
    }>;
    isAuthenticated: () => Promise<boolean>;
    getUserEmail: () => Promise<string | null>;
    exportEmails: (
      contacts: Array<{
        name: string;
        chatId?: string;
        emails?: string[];
        phones?: string[];
      }>,
    ) => Promise<{
      success: boolean;
      error?: string;
      canceled?: boolean;
      exportPath?: string;
      results?: Array<{
        contactName: string;
        success: boolean;
        textMessageCount: number;
        emailCount?: number;
        error: string | null;
      }>;
    }>;
    signout: () => Promise<{ success: boolean }>;
    onDeviceCode: (callback: (info: unknown) => void) => () => void;
    onExportProgress: (callback: (progress: unknown) => void) => () => void;
  };

  // Auto-update (migrated from window.electron)
  update: {
    onAvailable: (callback: (info: unknown) => void) => () => void;
    onProgress: (callback: (progress: unknown) => void) => () => void;
    onDownloaded: (callback: (info: unknown) => void) => () => void;
    install: () => void;
  };

  // Device detection methods (Windows)
  device?: {
    list: () => Promise<{
      success: boolean;
      devices?: Array<{
        udid: string;
        name: string;
        productType: string;
        productVersion: string;
        serialNumber: string;
        isConnected: boolean;
      }>;
      error?: string;
    }>;
    startDetection: () => Promise<{ success: boolean; error?: string }>;
    stopDetection: () => Promise<{ success: boolean; error?: string }>;
    checkAvailability: () => Promise<{
      success: boolean;
      available?: boolean;
      error?: string;
    }>;
    onConnected: (
      callback: (device: {
        udid: string;
        name: string;
        productType: string;
        productVersion: string;
        serialNumber: string;
        isConnected: boolean;
      }) => void,
    ) => () => void;
    onDisconnected: (
      callback: (device: {
        udid: string;
        name: string;
        productType: string;
        productVersion: string;
        serialNumber: string;
        isConnected: boolean;
      }) => void,
    ) => () => void;
  };

  // Backup methods (Windows)
  backup?: {
    getCapabilities: () => Promise<{
      supportsDomainFiltering: boolean;
      supportsIncremental: boolean;
      supportsSkipApps: boolean;
      supportsEncryption: boolean;
      availableDomains: string[];
    }>;
    getStatus: () => Promise<{
      isRunning: boolean;
      currentDeviceUdid: string | null;
      progress: {
        phase: string;
        percentComplete: number;
        currentFile: string | null;
        filesTransferred: number;
        totalFiles: number | null;
        bytesTransferred: number;
        totalBytes: number | null;
        estimatedTimeRemaining: number | null;
      } | null;
    }>;
    start: (options: {
      udid: string;
      outputDir?: string;
      forceFullBackup?: boolean;
      skipApps?: boolean;
    }) => Promise<{
      success: boolean;
      backupPath: string | null;
      error: string | null;
      duration: number;
      deviceUdid: string;
      isIncremental: boolean;
      backupSize: number;
    }>;
    startWithPassword: (options: {
      udid: string;
      password: string;
      outputPath?: string;
    }) => Promise<{
      success: boolean;
      backupPath?: string;
      error?: string;
      errorCode?: string;
    }>;
    cancel: () => Promise<{ success: boolean }>;
    list: () => Promise<
      Array<{
        path: string;
        deviceUdid: string;
        createdAt: Date;
        size: number;
        isEncrypted: boolean;
        iosVersion: string | null;
        deviceName: string | null;
      }>
    >;
    delete: (
      backupPath: string,
    ) => Promise<{ success: boolean; error?: string }>;
    cleanup: (
      keepCount?: number,
    ) => Promise<{ success: boolean; error?: string }>;
    checkEncryption: (udid: string) => Promise<{
      success: boolean;
      isEncrypted?: boolean;
      needsPassword?: boolean;
      error?: string;
    }>;
    verifyPassword: (
      backupPath: string,
      password: string,
    ) => Promise<{ success: boolean; valid?: boolean; error?: string }>;
    isEncrypted: (
      backupPath: string,
    ) => Promise<{ success: boolean; isEncrypted?: boolean; error?: string }>;
    onProgress: (
      callback: (progress: {
        phase: string;
        percentComplete: number;
        currentFile: string | null;
        filesTransferred: number;
        totalFiles: number | null;
        bytesTransferred: number;
        totalBytes: number | null;
        estimatedTimeRemaining: number | null;
      }) => void,
    ) => () => void;
    onComplete: (
      callback: (result: {
        success: boolean;
        backupPath: string | null;
        error: string | null;
        duration: number;
        deviceUdid: string;
        isIncremental: boolean;
        backupSize: number;
      }) => void,
    ) => () => void;
    onError: (callback: (error: { message: string }) => void) => () => void;
  };

  // Drivers methods (Windows)
  drivers?: {
    checkApple: () => Promise<{
      isInstalled: boolean;
      version: string | null;
      serviceRunning: boolean;
      error: string | null;
    }>;
    hasBundled: () => Promise<{ available: boolean }>;
    installApple: () => Promise<{
      success: boolean;
      error: string | null;
      rebootRequired: boolean;
    }>;
    openITunesStore: () => Promise<{ success: boolean; error?: string }>;
  };

  // Sync methods (Windows)
  sync?: {
    start: (options: {
      udid: string;
      password?: string;
      forceFullBackup?: boolean;
    }) => Promise<{
      success: boolean;
      messages: unknown[];
      contacts: unknown[];
      conversations: unknown[];
      error: string | null;
      duration: number;
    }>;
    cancel: () => Promise<{ success: boolean }>;
    status: () => Promise<{ isRunning: boolean; phase: string }>;
    devices: () => Promise<
      Array<{
        udid: string;
        name: string;
        productType: string;
        productVersion: string;
        serialNumber: string;
        isConnected: boolean;
      }>
    >;
    startDetection: (intervalMs?: number) => Promise<{ success: boolean }>;
    stopDetection: () => Promise<{ success: boolean }>;
    onProgress: (
      callback: (progress: {
        phase: string;
        phaseProgress: number;
        overallProgress: number;
        message: string;
      }) => void,
    ) => () => void;
    onPhase: (callback: (phase: string) => void) => () => void;
    onDeviceConnected: (callback: (device: unknown) => void) => () => void;
    onDeviceDisconnected: (callback: (device: unknown) => void) => () => void;
    onPasswordRequired: (callback: () => void) => () => void;
    onError: (callback: (error: { message: string }) => void) => () => void;
    onComplete: (callback: (result: unknown) => void) => () => void;
    onWaitingForPasscode: (callback: () => void) => () => void;
    onPasscodeEntered: (callback: () => void) => () => void;
  };

  // Event listeners for mailbox connections
  onGoogleMailboxConnected: (
    callback: (result: { success: boolean }) => void,
  ) => () => void;
  onGoogleMailboxCancelled: (callback: () => void) => () => void;
  onMicrosoftMailboxConnected: (
    callback: (result: { success: boolean }) => void,
  ) => () => void;
  onMicrosoftMailboxCancelled: (callback: () => void) => () => void;
  onGoogleMailboxDisconnected: (
    callback: (result: { success: boolean }) => void,
  ) => () => void;
  onMicrosoftMailboxDisconnected: (
    callback: (result: { success: boolean }) => void,
  ) => () => void;
  // Pre-DB mailbox connection events (for collecting tokens before DB init)
  onGoogleMailboxPendingConnected: (
    callback: (result: {
      success: boolean;
      email?: string;
      tokens?: {
        access_token: string;
        refresh_token: string | null;
        expires_at: string;
        scopes: string;
      };
      error?: string;
    }) => void,
  ) => () => void;
  onGoogleMailboxPendingCancelled: (callback: () => void) => () => void;
  onMicrosoftMailboxPendingConnected: (
    callback: (result: {
      success: boolean;
      email?: string;
      tokens?: {
        access_token: string;
        refresh_token: string | null;
        expires_at: string;
        scopes: string;
      };
      error?: string;
    }) => void,
  ) => () => void;
  onMicrosoftMailboxPendingCancelled: (callback: () => void) => () => void;
  onGoogleLoginComplete: (
    callback: (result: {
      success: boolean;
      user?: User;
      sessionToken?: string;
      subscription?: Subscription;
      isNewUser?: boolean;
      pendingLogin?: boolean;
      error?: string;
    }) => void,
  ) => () => void;
  onMicrosoftLoginComplete: (
    callback: (result: {
      success: boolean;
      user?: User;
      sessionToken?: string;
      subscription?: Subscription;
      isNewUser?: boolean;
      pendingLogin?: boolean;
      error?: string;
    }) => void,
  ) => () => void;
  // Event listeners for pending login (OAuth succeeded but DB not initialized - login-first flow)
  onGoogleLoginPending: (
    callback: (result: {
      success: boolean;
      pendingLogin?: boolean;
      oauthData?: unknown;
      error?: string;
    }) => void,
  ) => () => void;
  onMicrosoftLoginPending: (
    callback: (result: {
      success: boolean;
      pendingLogin?: boolean;
      oauthData?: unknown;
      error?: string;
    }) => void,
  ) => () => void;
  // Event listeners for login cancelled (user closed popup window)
  onGoogleLoginCancelled: (callback: () => void) => () => void;
  onMicrosoftLoginCancelled: (callback: () => void) => () => void;
  onTransactionScanProgress: (
    callback: (progress: unknown) => void,
  ) => () => void;
  onExportFolderProgress: (
    callback: (progress: { stage: string; current: number; total: number; message: string }) => void,
  ) => () => void;

  // Error Logging API (TASK-1800)
  errorLogging: {
    /**
     * Submit an error report to Supabase
     * @param payload - Error details and optional user feedback
     * @returns Result with success status and error ID
     */
    submit: (payload: {
      errorType: string;
      errorCode?: string;
      errorMessage: string;
      stackTrace?: string;
      currentScreen?: string;
      userFeedback?: string;
      breadcrumbs?: Record<string, unknown>[];
      appState?: Record<string, unknown>;
    }) => Promise<{
      success: boolean;
      errorId?: string;
      error?: string;
    }>;
    /**
     * Process queued errors (call when connection restored)
     * @returns Number of errors successfully processed
     */
    processQueue: () => Promise<{
      success: boolean;
      processedCount?: number;
      error?: string;
    }>;
    /**
     * Get current queue size (for diagnostics)
     * @returns Queue size
     */
    getQueueSize: () => Promise<{
      success: boolean;
      queueSize?: number;
      error?: string;
    }>;
  };

  // App Reset API (TASK-1802)
  app: {
    /**
     * Perform a complete app data reset
     * WARNING: This is a destructive operation that will:
     * - Delete all local data (database, preferences, cached data)
     * - Restart the app fresh
     *
     * Cloud data (Supabase) is NOT affected.
     *
     * @returns Result with success status
     */
    reset: () => Promise<{
      success: boolean;
      error?: string;
    }>;
  };

  // License API (BACKLOG-426, SPRINT-062)
  license: {
    /** Get current user's license information */
    get: () => Promise<{
      success: boolean;
      license?: UserLicense;
      error?: string;
    }>;
    /** Refresh license data from database */
    refresh: () => Promise<{
      success: boolean;
      license?: UserLicense;
      error?: string;
    }>;

    // ============================================
    // SPRINT-062: License Validation Methods
    // ============================================

    /** Validates the user's license status */
    validate: (userId: string) => Promise<{
      isValid: boolean;
      licenseType: "trial" | "individual" | "team";
      trialStatus?: "active" | "expired" | "converted";
      trialDaysRemaining?: number;
      transactionCount: number;
      transactionLimit: number;
      canCreateTransaction: boolean;
      deviceCount: number;
      deviceLimit: number;
      aiEnabled: boolean;
      blockReason?: "expired" | "limit_reached" | "no_license" | "suspended";
    }>;

    /** Creates a trial license for a new user */
    create: (userId: string) => Promise<{
      isValid: boolean;
      licenseType: "trial" | "individual" | "team";
      trialStatus?: "active" | "expired" | "converted";
      trialDaysRemaining?: number;
      transactionCount: number;
      transactionLimit: number;
      canCreateTransaction: boolean;
      deviceCount: number;
      deviceLimit: number;
      aiEnabled: boolean;
      blockReason?: "expired" | "limit_reached" | "no_license" | "suspended";
    }>;

    /** Increments the user's transaction count */
    incrementTransactionCount: (userId: string) => Promise<number>;

    /** Clears the license cache (call on logout) */
    clearCache: () => Promise<void>;

    /** Checks if an action is allowed based on license status */
    canPerformAction: (
      status: {
        isValid: boolean;
        licenseType: "trial" | "individual" | "team";
        transactionCount: number;
        transactionLimit: number;
        canCreateTransaction: boolean;
        deviceCount: number;
        deviceLimit: number;
        aiEnabled: boolean;
        blockReason?: "expired" | "limit_reached" | "no_license" | "suspended";
      },
      action: "create_transaction" | "use_ai" | "export"
    ) => Promise<boolean>;

    // ============================================
    // SPRINT-062: Device Registration Methods
    // ============================================

    /** Registers the current device for the user */
    registerDevice: (userId: string) => Promise<{
      success: boolean;
      device?: {
        id: string;
        user_id: string;
        device_id: string;
        device_name: string | null;
        os: string | null;
        platform: "macos" | "windows" | "linux" | null;
        app_version: string | null;
        is_active: boolean;
        last_seen_at: string;
        activated_at: string;
      };
      error?: "device_limit_reached" | "already_registered" | "unknown";
    }>;

    /** Lists all registered devices for a user */
    listRegisteredDevices: (userId: string) => Promise<Array<{
      id: string;
      user_id: string;
      device_id: string;
      device_name: string | null;
      os: string | null;
      platform: "macos" | "windows" | "linux" | null;
      app_version: string | null;
      is_active: boolean;
      last_seen_at: string;
      activated_at: string;
    }>>;

    /** Deactivates a device */
    deactivateDevice: (userId: string, deviceId: string) => Promise<void>;

    /** Deletes a device registration */
    deleteDevice: (userId: string, deviceId: string) => Promise<void>;

    /** Gets the current device's ID */
    getCurrentDeviceId: () => Promise<string>;

    /** Checks if the current device is registered */
    isDeviceRegistered: (userId: string) => Promise<boolean>;

    /** Sends a heartbeat to update device last_seen_at */
    deviceHeartbeat: (userId: string) => Promise<void>;
  };

  // ==========================================
  // DEEP LINK AUTH EVENTS (TASK-1500, enhanced TASK-1507)
  // ==========================================

  /**
   * Listen for deep link auth callback with tokens and license status
   * Fired when app receives magicaudit://callback and auth/license validation succeeds
   * TASK-1507: Enhanced to include user, license, and device data
   */
  onDeepLinkAuthCallback: (
    callback: (data: {
      accessToken: string;
      refreshToken: string;
      userId?: string;
      user?: {
        id: string;
        email?: string;
        name?: string;
      };
      licenseStatus?: {
        isValid: boolean;
        licenseType: "trial" | "individual" | "team";
        trialDaysRemaining?: number;
        transactionCount: number;
        transactionLimit: number;
        canCreateTransaction: boolean;
        deviceCount: number;
        deviceLimit: number;
        aiEnabled: boolean;
        blockReason?: string;
      };
      device?: {
        id: string;
        device_id: string;
        device_name: string | null;
      };
    }) => void,
  ) => () => void;

  /**
   * Listen for deep link auth errors
   * Fired when callback URL is invalid, tokens are missing, or auth fails
   */
  onDeepLinkAuthError: (
    callback: (data: { error: string; code: "MISSING_TOKENS" | "INVALID_URL" | "INVALID_TOKENS" | "UNKNOWN_ERROR" }) => void,
  ) => () => void;

  /**
   * Listen for deep link license blocked events (TASK-1507)
   * Fired when user authenticates successfully but license is expired/suspended
   */
  onDeepLinkLicenseBlocked: (
    callback: (data: {
      accessToken: string;
      refreshToken: string;
      userId: string;
      blockReason: string;
      licenseStatus: {
        isValid: boolean;
        licenseType: "trial" | "individual" | "team";
        blockReason?: string;
      };
    }) => void,
  ) => () => void;

  /**
   * Listen for deep link device limit events (TASK-1507)
   * Fired when user authenticates successfully but device registration fails due to limit
   */
  onDeepLinkDeviceLimit: (
    callback: (data: {
      accessToken: string;
      refreshToken: string;
      userId: string;
      licenseStatus: {
        isValid: boolean;
        licenseType: "trial" | "individual" | "team";
        deviceCount: number;
        deviceLimit: number;
      };
    }) => void,
  ) => () => void;
}

// Augment Window interface
declare global {
  interface Window {
    api: WindowApi;
    electron: {
      platform: NodeJS.Platform;
      getAppInfo: () => Promise<{ version: string; name: string }>;
      getMacOSVersion: () => Promise<{ version: string }>;
      checkAppLocation: () => Promise<{
        isInApplications: boolean;
        shouldPrompt: boolean;
        appPath: string;
      }>;
      checkPermissions: () => Promise<{
        hasPermission: boolean;
        error?: string;
      }>;
      triggerFullDiskAccess: () => Promise<{ hasAccess: boolean }>;
      requestPermissions: () => Promise<{ success: boolean }>;
      requestContactsPermission: () => Promise<{ granted: boolean }>;
      openSystemSettings: () => Promise<{ success: boolean }>;
      getConversations: () => Promise<{
        success: boolean;
        conversations?: ConversationSummary[];
        error?: string;
      }>;
      exportConversations: (
        conversationIds: string[],
      ) => Promise<{ success: boolean; error?: string; canceled?: boolean }>;
      openFolder: (path: string) => Promise<void>;
      outlookInitialize: () => Promise<{ success: boolean; error?: string }>;
      outlookIsAuthenticated: () => Promise<boolean>;
      outlookAuthenticate: () => Promise<{
        success: boolean;
        error?: string;
        userInfo?: { username?: string };
      }>;
      outlookGetUserEmail: () => Promise<string | null>;
      outlookExportEmails: (
        contacts: Array<{
          name: string;
          chatId?: string;
          emails?: string[];
          phones?: string[];
        }>,
      ) => Promise<{
        success: boolean;
        error?: string;
        canceled?: boolean;
        exportPath?: string;
        results?: Array<{
          contactName: string;
          success: boolean;
          textMessageCount: number;
          emailCount?: number;
          error: string | null;
        }>;
      }>;
      onDeviceCode: (callback: (code: string) => void) => () => void;
      onExportProgress: (
        callback: (progress: ExportProgress) => void,
      ) => () => void;
      onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void;
      onUpdateProgress: (
        callback: (progress: UpdateProgress) => void,
      ) => () => void;
      onUpdateDownloaded: (callback: () => void) => () => void;
      installUpdate: () => void;
    };
  }
}
