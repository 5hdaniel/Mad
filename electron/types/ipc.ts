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
} from "./models";
import type { ExportResult, ExtractionResult, SyncStatus } from "./database";

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
    response: { imported: number; skipped: number; errors: string[] };
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
      fullDiskAccess: boolean;
      contactsAccess: boolean;
      allGranted: boolean;
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
  };

  // System methods
  system: {
    runPermissionSetup: () => Promise<{ success: boolean }>;
    requestContactsPermission: () => Promise<{ granted: boolean }>;
    setupFullDiskAccess: () => Promise<{ success: boolean }>;
    openPrivacyPane: (pane: string) => Promise<{ success: boolean }>;
    checkFullDiskAccessStatus: () => Promise<{ hasAccess: boolean }>;
    checkFullDiskAccess: () => Promise<{ hasAccess: boolean }>;
    checkContactsPermission: () => Promise<{ hasPermission: boolean }>;
    checkAllPermissions: () => Promise<{
      fullDiskAccess: boolean;
      contactsAccess: boolean;
      allGranted: boolean;
    }>;
    checkGoogleConnection: (
      userId: string,
    ) => Promise<{ connected: boolean; email?: string; error?: string }>;
    checkMicrosoftConnection: (
      userId: string,
    ) => Promise<{ connected: boolean; email?: string; error?: string }>;
    checkAllConnections: (userId: string) => Promise<{
      success: boolean;
      google?: { connected: boolean; email?: string };
      microsoft?: { connected: boolean; email?: string };
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
      contacts: any[],
    ) => Promise<{ success: boolean; imported?: number; error?: string }>;
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
    ) => Promise<{ success: boolean; transaction?: unknown; error?: string }>;
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
      options?: { exportFormat?: string; includeContacts?: boolean; includeEmails?: boolean; includeSummary?: boolean },
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
      status: "active" | "closed",
    ) => Promise<{
      success: boolean;
      updatedCount?: number;
      errors?: string[];
      error?: string;
    }>;
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
        conversations?: any[];
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
      onExportProgress: (callback: (progress: any) => void) => () => void;
      onUpdateAvailable: (callback: (info: any) => void) => () => void;
      onUpdateProgress: (callback: (progress: any) => void) => () => void;
      onUpdateDownloaded: (callback: () => void) => () => void;
      installUpdate: () => void;
    };
  }
}
