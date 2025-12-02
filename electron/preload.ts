/**
 * ============================================
 * PRELOAD SCRIPT - IPC BRIDGE
 * ============================================
 * This file safely exposes IPC methods to the renderer process via contextBridge.
 * It acts as a secure bridge between the main process and renderer process.
 *
 * Each method is documented with:
 * - Purpose and functionality
 * - Parameters required
 * - Return value structure
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  /**
   * ============================================
   * AUTHENTICATION METHODS
   * ============================================
   * Handles user authentication, OAuth flows, and session management
   */
  auth: {
    /**
     * Initiates Google OAuth login flow
     * @returns {Promise<{success: boolean, authUrl?: string, error?: string}>} Login initiation result
     */
    googleLogin: () => ipcRenderer.invoke('auth:google:login'),

    /**
     * Completes Google OAuth login with authorization code
     * @param {string} code - OAuth authorization code from Google
     * @returns {Promise<{success: boolean, user?: object, sessionToken?: string, error?: string}>} Login completion result
     */
    googleCompleteLogin: (code: string) => ipcRenderer.invoke('auth:google:complete-login', code),

    /**
     * Initiates Microsoft OAuth login flow
     * @returns {Promise<{success: boolean, authUrl?: string, error?: string}>} Login initiation result
     */
    microsoftLogin: () => ipcRenderer.invoke('auth:microsoft:login'),

    /**
     * Completes Microsoft OAuth login with authorization code
     * @param {string} code - OAuth authorization code from Microsoft
     * @returns {Promise<{success: boolean, user?: object, sessionToken?: string, error?: string}>} Login completion result
     */
    microsoftCompleteLogin: (code: string) => ipcRenderer.invoke('auth:microsoft:complete-login', code),

    /**
     * Connects Google mailbox for a logged-in user
     * @param {string} userId - User ID to connect mailbox for
     * @returns {Promise<{success: boolean, error?: string}>} Connection result
     */
    googleConnectMailbox: (userId: string) => ipcRenderer.invoke('auth:google:connect-mailbox', userId),

    /**
     * Connects Microsoft mailbox for a logged-in user
     * @param {string} userId - User ID to connect mailbox for
     * @returns {Promise<{success: boolean, error?: string}>} Connection result
     */
    microsoftConnectMailbox: (userId: string) => ipcRenderer.invoke('auth:microsoft:connect-mailbox', userId),

    /**
     * Logs out the current user and invalidates session
     * @param {string} sessionToken - Session token to invalidate
     * @returns {Promise<{success: boolean, error?: string}>} Logout result
     */
    logout: (sessionToken: string) => ipcRenderer.invoke('auth:logout', sessionToken),

    /**
     * Validates an existing session token
     * @param {string} sessionToken - Session token to validate
     * @returns {Promise<{valid: boolean, user?: object, error?: string}>} Validation result
     */
    validateSession: (sessionToken: string) => ipcRenderer.invoke('auth:validate-session', sessionToken),

    /**
     * Gets the currently authenticated user
     * @returns {Promise<{success: boolean, user?: object, error?: string}>} Current user data
     */
    getCurrentUser: () => ipcRenderer.invoke('auth:get-current-user'),

    /**
     * Records user's acceptance of terms and conditions
     * @param {string} userId - User ID accepting terms
     * @returns {Promise<{success: boolean, error?: string}>} Acceptance result
     */
    acceptTerms: (userId: string) => ipcRenderer.invoke('auth:accept-terms', userId),

    /**
     * Marks email onboarding as completed for a user
     * @param {string} userId - User ID completing email onboarding
     * @returns {Promise<{success: boolean, error?: string}>} Completion result
     */
    completeEmailOnboarding: (userId: string) => ipcRenderer.invoke('auth:complete-email-onboarding', userId),

    /**
     * Checks if user has completed email onboarding
     * @param {string} userId - User ID to check
     * @returns {Promise<{success: boolean, completed: boolean, error?: string}>} Onboarding status
     */
    checkEmailOnboarding: (userId: string) => ipcRenderer.invoke('auth:check-email-onboarding', userId),
  },

  /**
   * ============================================
   * TRANSACTION METHODS
   * ============================================
   * Manages real estate transactions, email scanning, and export functionality
   */
  transactions: {
    /**
     * Scans user's mailbox for real estate transaction emails
     * @param {string} userId - User ID to scan emails for
     * @param {Object} options - Scan options (provider, dateRange, propertyAddress, etc.)
     * @returns {Promise<{success: boolean, newCount?: number, updatedCount?: number, error?: string}>} Scan results
     */
    scan: (userId: string, options: any) => ipcRenderer.invoke('transactions:scan', userId, options),

    /**
     * Retrieves all transactions for a user
     * @param {string} userId - User ID to get transactions for
     * @returns {Promise<{success: boolean, transactions?: Array, error?: string}>} All user transactions
     */
    getAll: (userId: string) => ipcRenderer.invoke('transactions:get-all', userId),

    /**
     * Creates a new manual transaction
     * @param {string} userId - User ID creating the transaction
     * @param {Object} transactionData - Transaction details (address, type, status, dates, etc.)
     * @returns {Promise<{success: boolean, transaction?: object, error?: string}>} Created transaction
     */
    create: (userId: string, transactionData: any) => ipcRenderer.invoke('transactions:create', userId, transactionData),

    /**
     * Creates a new audited transaction with verified data
     * @param {string} userId - User ID creating the transaction
     * @param {Object} transactionData - Audited transaction details
     * @returns {Promise<{success: boolean, transaction?: object, error?: string}>} Created audited transaction
     */
    createAudited: (userId: string, transactionData: any) => ipcRenderer.invoke('transactions:create-audited', userId, transactionData),

    /**
     * Gets detailed information for a specific transaction
     * @param {string} transactionId - Transaction ID to retrieve
     * @returns {Promise<{success: boolean, transaction?: object, error?: string}>} Transaction details
     */
    getDetails: (transactionId: string) => ipcRenderer.invoke('transactions:get-details', transactionId),

    /**
     * Gets transaction with all associated contacts
     * @param {string} transactionId - Transaction ID to retrieve
     * @returns {Promise<{success: boolean, transaction?: object, contacts?: Array, error?: string}>} Transaction with contacts
     */
    getWithContacts: (transactionId: string) => ipcRenderer.invoke('transactions:get-with-contacts', transactionId),

    /**
     * Updates transaction details
     * @param {string} transactionId - Transaction ID to update
     * @param {Object} updates - Fields to update (status, dates, address, etc.)
     * @returns {Promise<{success: boolean, transaction?: object, error?: string}>} Updated transaction
     */
    update: (transactionId: string, updates: any) => ipcRenderer.invoke('transactions:update', transactionId, updates),

    /**
     * Deletes a transaction
     * @param {string} transactionId - Transaction ID to delete
     * @returns {Promise<{success: boolean, error?: string}>} Deletion result
     */
    delete: (transactionId: string) => ipcRenderer.invoke('transactions:delete', transactionId),

    /**
     * Assigns a contact to a transaction with a specific role
     * @param {string} transactionId - Transaction ID
     * @param {string} contactId - Contact ID to assign
     * @param {string} role - Contact's role (e.g., "Buyer's Agent", "Seller", etc.)
     * @param {string} roleCategory - Role category (buyer_side, seller_side, neutral, etc.)
     * @param {boolean} isPrimary - Whether this is the primary contact for this role
     * @param {string} notes - Additional notes about this assignment
     * @returns {Promise<{success: boolean, error?: string}>} Assignment result
     */
    assignContact: (transactionId: string, contactId: string, role: string, roleCategory: string, isPrimary: boolean, notes: string) =>
      ipcRenderer.invoke('transactions:assign-contact', transactionId, contactId, role, roleCategory, isPrimary, notes),

    /**
     * Removes a contact from a transaction
     * @param {string} transactionId - Transaction ID
     * @param {string} contactId - Contact ID to remove
     * @returns {Promise<{success: boolean, error?: string}>} Removal result
     */
    removeContact: (transactionId: string, contactId: string) => ipcRenderer.invoke('transactions:remove-contact', transactionId, contactId),

    /**
     * Re-analyzes emails for a specific property and date range
     * @param {string} userId - User ID
     * @param {string} provider - Email provider (google or microsoft)
     * @param {string} propertyAddress - Property address to search for
     * @param {Object} dateRange - Date range to search within {start, end}
     * @returns {Promise<{success: boolean, newCount?: number, updatedCount?: number, error?: string}>} Re-analysis results
     */
    reanalyze: (userId: string, provider: string, propertyAddress: string, dateRange: any) =>
      ipcRenderer.invoke('transactions:reanalyze', userId, provider, propertyAddress, dateRange),

    /**
     * Exports transaction as PDF to specified path
     * @param {string} transactionId - Transaction ID to export
     * @param {string} outputPath - File path to save PDF
     * @returns {Promise<{success: boolean, filePath?: string, error?: string}>} Export result
     */
    exportPDF: (transactionId: string, outputPath: string) => ipcRenderer.invoke('transactions:export-pdf', transactionId, outputPath),

    /**
     * Exports transaction with enhanced options (format, included data, etc.)
     * @param {string} transactionId - Transaction ID to export
     * @param {Object} options - Export options (format, includeContacts, includeEmails, etc.)
     * @returns {Promise<{success: boolean, filePath?: string, error?: string}>} Export result
     */
    exportEnhanced: (transactionId: string, options: any) => ipcRenderer.invoke('transactions:export-enhanced', transactionId, options),
  },

  /**
   * ============================================
   * CONTACT METHODS
   * ============================================
   * Manages contacts, imports, and contact-transaction associations
   */
  contacts: {
    /**
     * Retrieves all contacts for a user
     * @param {string} userId - User ID to get contacts for
     * @returns {Promise<{success: boolean, contacts?: Array, error?: string}>} All user contacts
     */
    getAll: (userId: string) => ipcRenderer.invoke('contacts:get-all', userId),

    /**
     * Gets contacts available for assignment (not deleted/archived)
     * @param {string} userId - User ID to get available contacts for
     * @returns {Promise<{success: boolean, contacts?: Array, error?: string}>} Available contacts
     */
    getAvailable: (userId: string) => ipcRenderer.invoke('contacts:get-available', userId),

    /**
     * Imports contacts from system address book or external source
     * @param {string} userId - User ID importing contacts
     * @param {Array} contactsToImport - Array of contact objects to import
     * @returns {Promise<{success: boolean, imported?: number, skipped?: number, error?: string}>} Import results
     */
    import: (userId: string, contactsToImport: any[]) => ipcRenderer.invoke('contacts:import', userId, contactsToImport),

    /**
     * Gets contacts sorted by activity/relevance for a property
     * @param {string} userId - User ID
     * @param {string} propertyAddress - Property address to find relevant contacts for
     * @returns {Promise<{success: boolean, contacts?: Array, error?: string}>} Sorted contacts
     */
    getSortedByActivity: (userId: string, propertyAddress: string) => ipcRenderer.invoke('contacts:get-sorted-by-activity', userId, propertyAddress),

    /**
     * Creates a new contact
     * @param {string} userId - User ID creating the contact
     * @param {Object} contactData - Contact details (name, email, phone, company, etc.)
     * @returns {Promise<{success: boolean, contact?: object, error?: string}>} Created contact
     */
    create: (userId: string, contactData: any) => ipcRenderer.invoke('contacts:create', userId, contactData),

    /**
     * Updates contact details
     * @param {string} contactId - Contact ID to update
     * @param {Object} updates - Fields to update (name, email, phone, etc.)
     * @returns {Promise<{success: boolean, contact?: object, error?: string}>} Updated contact
     */
    update: (contactId: string, updates: any) => ipcRenderer.invoke('contacts:update', contactId, updates),

    /**
     * Checks if a contact can be deleted (not assigned to transactions)
     * @param {string} contactId - Contact ID to check
     * @returns {Promise<{canDelete: boolean, reason?: string, transactionCount?: number}>} Deletion eligibility
     */
    checkCanDelete: (contactId: string) => ipcRenderer.invoke('contacts:checkCanDelete', contactId),

    /**
     * Deletes a contact (only if not assigned to transactions)
     * @param {string} contactId - Contact ID to delete
     * @returns {Promise<{success: boolean, error?: string}>} Deletion result
     */
    delete: (contactId: string) => ipcRenderer.invoke('contacts:delete', contactId),

    /**
     * Removes a contact (soft delete/archive)
     * @param {string} contactId - Contact ID to remove
     * @returns {Promise<{success: boolean, error?: string}>} Removal result
     */
    remove: (contactId: string) => ipcRenderer.invoke('contacts:remove', contactId),
  },

  /**
   * ============================================
   * ADDRESS VERIFICATION METHODS
   * ============================================
   * Integrates with Google Places API for address validation and geocoding
   */
  address: {
    /**
     * Initializes Google Places API with API key
     * @param {string} apiKey - Google Places API key
     * @returns {Promise<{success: boolean, error?: string}>} Initialization result
     */
    initialize: (apiKey: string) => ipcRenderer.invoke('address:initialize', apiKey),

    /**
     * Gets address autocomplete suggestions
     * @param {string} input - Partial address input
     * @param {string} sessionToken - Session token for request batching
     * @returns {Promise<{success: boolean, suggestions?: Array, error?: string}>} Address suggestions
     */
    getSuggestions: (input: string, sessionToken: string) => ipcRenderer.invoke('address:get-suggestions', input, sessionToken),

    /**
     * Gets detailed information for a specific place
     * @param {string} placeId - Google Place ID
     * @returns {Promise<{success: boolean, place?: object, error?: string}>} Place details
     */
    getDetails: (placeId: string) => ipcRenderer.invoke('address:get-details', placeId),

    /**
     * Geocodes an address to coordinates
     * @param {string} address - Address to geocode
     * @returns {Promise<{success: boolean, coordinates?: {lat: number, lng: number}, error?: string}>} Geocoding result
     */
    geocode: (address: string) => ipcRenderer.invoke('address:geocode', address),

    /**
     * Validates and standardizes an address
     * @param {string} address - Address to validate
     * @returns {Promise<{valid: boolean, standardized?: string, components?: object, error?: string}>} Validation result
     */
    validate: (address: string) => ipcRenderer.invoke('address:validate', address),
  },

  /**
   * ============================================
   * FEEDBACK METHODS
   * ============================================
   * Manages user feedback for AI extraction corrections and learning
   */
  feedback: {
    /**
     * Submits user feedback to improve extraction accuracy
     * @param {string} userId - User ID submitting feedback
     * @param {Object} feedbackData - Feedback details (field, original, corrected, etc.)
     * @returns {Promise<{success: boolean, error?: string}>} Submission result
     */
    submit: (userId: string, feedbackData: any) => ipcRenderer.invoke('feedback:submit', userId, feedbackData),

    /**
     * Gets all feedback entries for a transaction
     * @param {string} transactionId - Transaction ID
     * @returns {Promise<{success: boolean, feedback?: Array, error?: string}>} Transaction feedback
     */
    getForTransaction: (transactionId: string) => ipcRenderer.invoke('feedback:get-for-transaction', transactionId),

    /**
     * Gets accuracy metrics for a specific field
     * @param {string} userId - User ID
     * @param {string} fieldName - Field name to get metrics for (e.g., 'propertyAddress')
     * @returns {Promise<{success: boolean, metrics?: object, error?: string}>} Field metrics
     */
    getMetrics: (userId: string, fieldName: string) => ipcRenderer.invoke('feedback:get-metrics', userId, fieldName),

    /**
     * Gets AI suggestion based on learning from past feedback
     * @param {string} userId - User ID
     * @param {string} fieldName - Field name
     * @param {any} extractedValue - Currently extracted value
     * @param {number} confidence - Confidence score (0-1)
     * @returns {Promise<{success: boolean, suggestion?: any, confidence?: number, error?: string}>} AI suggestion
     */
    getSuggestion: (userId: string, fieldName: string, extractedValue: any, confidence: number) =>
      ipcRenderer.invoke('feedback:get-suggestion', userId, fieldName, extractedValue, confidence),

    /**
     * Gets learning statistics for a field (accuracy trends, improvement)
     * @param {string} userId - User ID
     * @param {string} fieldName - Field name
     * @returns {Promise<{success: boolean, stats?: object, error?: string}>} Learning stats
     */
    getLearningStats: (userId: string, fieldName: string) => ipcRenderer.invoke('feedback:get-learning-stats', userId, fieldName),
  },

  /**
   * ============================================
   * PREFERENCE METHODS
   * ============================================
   * Manages user preferences and settings
   */
  preferences: {
    /**
     * Gets all preferences for a user
     * @param {string} userId - User ID
     * @returns {Promise<{success: boolean, preferences?: object, error?: string}>} User preferences
     */
    get: (userId: string) => ipcRenderer.invoke('preferences:get', userId),

    /**
     * Saves all user preferences (overwrites existing)
     * @param {string} userId - User ID
     * @param {Object} preferences - Complete preferences object
     * @returns {Promise<{success: boolean, error?: string}>} Save result
     */
    save: (userId: string, preferences: any) => ipcRenderer.invoke('preferences:save', userId, preferences),

    /**
     * Updates specific preference fields (merges with existing)
     * @param {string} userId - User ID
     * @param {Object} partialPreferences - Preferences to update
     * @returns {Promise<{success: boolean, preferences?: object, error?: string}>} Update result
     */
    update: (userId: string, partialPreferences: any) => ipcRenderer.invoke('preferences:update', userId, partialPreferences),
  },

  /**
   * ============================================
   * SYSTEM METHODS
   * ============================================
   * System-level operations including permissions, connections, and health checks
   */
  system: {
    /**
     * Runs the complete permission setup flow for onboarding
     * @returns {Promise<{success: boolean, error?: string}>} Setup result
     */
    runPermissionSetup: () => ipcRenderer.invoke('system:run-permission-setup'),

    /**
     * Requests macOS contacts permission
     * @returns {Promise<{granted: boolean, error?: string}>} Permission request result
     */
    requestContactsPermission: () => ipcRenderer.invoke('system:request-contacts-permission'),

    /**
     * Initiates Full Disk Access setup process
     * @returns {Promise<{success: boolean, error?: string}>} Setup result
     */
    setupFullDiskAccess: () => ipcRenderer.invoke('system:setup-full-disk-access'),

    /**
     * Opens macOS System Preferences to a specific privacy pane
     * @param {string} pane - Privacy pane identifier (e.g., 'Privacy_AllFiles', 'Privacy_Contacts')
     * @returns {Promise<{success: boolean, error?: string}>} Open result
     */
    openPrivacyPane: (pane: string) => ipcRenderer.invoke('system:open-privacy-pane', pane),

    /**
     * Checks current Full Disk Access status
     * @returns {Promise<{granted: boolean, error?: string}>} Status check result
     */
    checkFullDiskAccessStatus: () => ipcRenderer.invoke('system:check-full-disk-access-status'),

    /**
     * Checks if app has Full Disk Access permission
     * @returns {Promise<{granted: boolean, error?: string}>} Permission status
     */
    checkFullDiskAccess: () => ipcRenderer.invoke('system:check-full-disk-access'),

    /**
     * Checks if app has Contacts permission
     * @returns {Promise<{granted: boolean, error?: string}>} Permission status
     */
    checkContactsPermission: () => ipcRenderer.invoke('system:check-contacts-permission'),

    /**
     * Checks all required system permissions
     * @returns {Promise<{allGranted: boolean, fullDiskAccess: boolean, contacts: boolean, error?: string}>} All permission statuses
     */
    checkAllPermissions: () => ipcRenderer.invoke('system:check-all-permissions'),

    /**
     * Checks Google account connection and token validity
     * @param {string} userId - User ID to check
     * @returns {Promise<{connected: boolean, valid: boolean, error?: string}>} Connection status
     */
    checkGoogleConnection: (userId: string) => ipcRenderer.invoke('system:check-google-connection', userId),

    /**
     * Checks Microsoft account connection and token validity
     * @param {string} userId - User ID to check
     * @returns {Promise<{connected: boolean, valid: boolean, error?: string}>} Connection status
     */
    checkMicrosoftConnection: (userId: string) => ipcRenderer.invoke('system:check-microsoft-connection', userId),

    /**
     * Checks all email provider connections
     * @param {string} userId - User ID to check
     * @returns {Promise<{google: object, microsoft: object, error?: string}>} All connection statuses
     */
    checkAllConnections: (userId: string) => ipcRenderer.invoke('system:check-all-connections', userId),

    /**
     * Runs comprehensive health check for a provider
     * @param {string} userId - User ID
     * @param {string} provider - Provider to check ('google' or 'microsoft')
     * @returns {Promise<{healthy: boolean, issues?: Array, error?: string}>} Health check result
     */
    healthCheck: (userId: string, provider: string) => ipcRenderer.invoke('system:health-check', userId, provider),

    /**
     * Opens support email with pre-filled content
     * @param {string} errorDetails - Optional error details to include
     * @returns {Promise<{success: boolean, error?: string}>} Result
     */
    contactSupport: (errorDetails?: string) => ipcRenderer.invoke('system:contact-support', errorDetails),

    /**
     * Gets diagnostic information for support requests
     * @returns {Promise<{success: boolean, diagnostics?: string, error?: string}>} Diagnostic data
     */
    getDiagnostics: () => ipcRenderer.invoke('system:get-diagnostics'),
  },

  /**
   * ============================================
   * BACKUP METHODS
   * ============================================
   * Manages iPhone backup operations including encryption support
   */
  backup: {
    /**
     * Check if a device requires encrypted backup
     * @param {string} udid - Device unique identifier
     * @returns {Promise<{success: boolean, isEncrypted?: boolean, needsPassword?: boolean, error?: string}>}
     */
    checkEncryption: (udid: string) => ipcRenderer.invoke('backup:check-encryption', udid),

    /**
     * Start a backup without password
     * Will fail with PASSWORD_REQUIRED if device has encryption enabled
     * @param {Object} options - Backup options (udid, outputPath, etc.)
     * @returns {Promise<{success: boolean, backupPath?: string, error?: string, errorCode?: string}>}
     */
    start: (options: { udid: string; outputPath?: string }) =>
      ipcRenderer.invoke('backup:start', options),

    /**
     * Start a backup with password (for encrypted backups)
     * @param {Object} options - Backup options including password
     * @returns {Promise<{success: boolean, backupPath?: string, error?: string, errorCode?: string}>}
     */
    startWithPassword: (options: { udid: string; password: string; outputPath?: string }) =>
      ipcRenderer.invoke('backup:start-with-password', options),

    /**
     * Cancel an in-progress backup
     * @returns {Promise<{success: boolean}>}
     */
    cancel: () => ipcRenderer.invoke('backup:cancel'),

    /**
     * Verify a backup password without starting backup
     * @param {string} backupPath - Path to the backup
     * @param {string} password - Password to verify
     * @returns {Promise<{success: boolean, valid?: boolean, error?: string}>}
     */
    verifyPassword: (backupPath: string, password: string) =>
      ipcRenderer.invoke('backup:verify-password', backupPath, password),

    /**
     * Check if an existing backup is encrypted
     * @param {string} backupPath - Path to the backup
     * @returns {Promise<{success: boolean, isEncrypted?: boolean, error?: string}>}
     */
    isEncrypted: (backupPath: string) =>
      ipcRenderer.invoke('backup:is-encrypted', backupPath),

    /**
     * Clean up backup files after extraction
     * @param {string} backupPath - Path to the backup to clean up
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    cleanup: (backupPath: string) =>
      ipcRenderer.invoke('backup:cleanup', backupPath),
  },

  /**
   * ============================================
   * EVENT LISTENERS
   * ============================================
   * Subscribe to asynchronous events from the main process
   */

  /**
   * Listens for Google login completion events
   * @param {Function} callback - Callback function to handle login result
   * @returns {Function} Cleanup function to remove listener
   */
  onGoogleLoginComplete: (callback: (result: any) => void) => {
    const listener = (_: IpcRendererEvent, result: any) => callback(result);
    ipcRenderer.on('google:login-complete', listener);
    return () => ipcRenderer.removeListener('google:login-complete', listener);
  },

  /**
   * Listens for Google mailbox connection events
   * @param {Function} callback - Callback function to handle connection result
   * @returns {Function} Cleanup function to remove listener
   */
  onGoogleMailboxConnected: (callback: (result: any) => void) => {
    const listener = (_: IpcRendererEvent, result: any) => callback(result);
    ipcRenderer.on('google:mailbox-connected', listener);
    return () => ipcRenderer.removeListener('google:mailbox-connected', listener);
  },

  /**
   * Listens for Google mailbox connection cancelled events (user closed popup)
   * @param {Function} callback - Callback function to handle cancellation
   * @returns {Function} Cleanup function to remove listener
   */
  onGoogleMailboxCancelled: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('google:mailbox-cancelled', listener);
    return () => ipcRenderer.removeListener('google:mailbox-cancelled', listener);
  },

  /**
   * Listens for Microsoft login completion events
   * @param {Function} callback - Callback function to handle login result
   * @returns {Function} Cleanup function to remove listener
   */
  onMicrosoftLoginComplete: (callback: (result: any) => void) => {
    const listener = (_: IpcRendererEvent, result: any) => callback(result);
    ipcRenderer.on('microsoft:login-complete', listener);
    return () => ipcRenderer.removeListener('microsoft:login-complete', listener);
  },

  /**
   * Listens for Microsoft mailbox connection events
   * @param {Function} callback - Callback function to handle connection result
   * @returns {Function} Cleanup function to remove listener
   */
  onMicrosoftMailboxConnected: (callback: (result: any) => void) => {
    const listener = (_: IpcRendererEvent, result: any) => callback(result);
    ipcRenderer.on('microsoft:mailbox-connected', listener);
    return () => ipcRenderer.removeListener('microsoft:mailbox-connected', listener);
  },

  /**
   * Listens for Microsoft mailbox connection cancelled events (user closed popup)
   * @param {Function} callback - Callback function to handle cancellation
   * @returns {Function} Cleanup function to remove listener
   */
  onMicrosoftMailboxCancelled: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('microsoft:mailbox-cancelled', listener);
    return () => ipcRenderer.removeListener('microsoft:mailbox-cancelled', listener);
  },

  /**
   * Listens for transaction scan progress updates
   * @param {Function} callback - Callback function to handle progress updates
   * @returns {Function} Cleanup function to remove listener
   */
  onTransactionScanProgress: (callback: (progress: any) => void) => {
    const listener = (_: IpcRendererEvent, progress: any) => callback(progress);
    ipcRenderer.on('transactions:scan-progress', listener);
    return () => ipcRenderer.removeListener('transactions:scan-progress', listener);
  },

  /**
   * Listens for backup progress updates
   * @param {Function} callback - Callback function to handle progress updates
   * @returns {Function} Cleanup function to remove listener
   */
  onBackupProgress: (callback: (progress: { phase: string; percent: number }) => void) => {
    const listener = (_: IpcRendererEvent, progress: { phase: string; percent: number }) => callback(progress);
    ipcRenderer.on('backup:progress', listener);
    return () => ipcRenderer.removeListener('backup:progress', listener);
  },

  /**
   * Listens for backup password required events
   * @param {Function} callback - Callback function when password is needed
   * @returns {Function} Cleanup function to remove listener
   */
  onBackupPasswordRequired: (callback: (data: { udid: string }) => void) => {
    const listener = (_: IpcRendererEvent, data: { udid: string }) => callback(data);
    ipcRenderer.on('backup:password-required', listener);
    return () => ipcRenderer.removeListener('backup:password-required', listener);
  },

  /**
   * ============================================
   * BACKUP METHODS
   * ============================================
   * iPhone backup operations for extracting messages and contacts
   */
  backup: {
    /**
     * Gets backup system capabilities
     * Note: Domain filtering is NOT supported - see docs/BACKUP_RESEARCH.md
     * @returns {Promise<BackupCapabilities>} Available capabilities
     */
    getCapabilities: () => ipcRenderer.invoke('backup:capabilities'),

    /**
     * Gets current backup status
     * @returns {Promise<BackupStatus>} Current status including progress
     */
    getStatus: () => ipcRenderer.invoke('backup:status'),

    /**
     * Starts a backup operation for the specified device
     * @param {BackupOptions} options - Backup options including device UDID
     * @returns {Promise<BackupResult>} Backup result
     */
    start: (options: { udid: string; outputDir?: string; forceFullBackup?: boolean; skipApps?: boolean }) =>
      ipcRenderer.invoke('backup:start', options),

    /**
     * Cancels an in-progress backup
     * @returns {Promise<{success: boolean}>} Cancellation result
     */
    cancel: () => ipcRenderer.invoke('backup:cancel'),

    /**
     * Lists all existing backups
     * @returns {Promise<BackupInfo[]>} List of backup information
     */
    list: () => ipcRenderer.invoke('backup:list'),

    /**
     * Deletes a specific backup
     * @param {string} backupPath - Path to the backup to delete
     * @returns {Promise<{success: boolean, error?: string}>} Deletion result
     */
    delete: (backupPath: string) => ipcRenderer.invoke('backup:delete', backupPath),

    /**
     * Cleans up old backups, keeping only the most recent
     * @param {number} keepCount - Number of backups to keep per device
     * @returns {Promise<{success: boolean, error?: string}>} Cleanup result
     */
    cleanup: (keepCount?: number) => ipcRenderer.invoke('backup:cleanup', keepCount),

    /**
     * Extracts only HomeDomain files from backup and deletes the rest.
     * This reduces storage from 20-60 GB to ~1-2 GB.
     * HomeDomain contains messages, contacts, call history, etc.
     * @param {string} backupPath - Path to the backup to process
     * @returns {Promise<{success: boolean, filesKept: number, filesDeleted: number, spaceFreed: number, error?: string}>}
     */
    extractHomeDomain: (backupPath: string) => ipcRenderer.invoke('backup:extractHomeDomain', backupPath),

    /**
     * Subscribes to backup progress updates
     * @param {Function} callback - Called with progress updates
     * @returns {Function} Cleanup function to remove listener
     */
    onProgress: (callback: (progress: any) => void) => {
      const listener = (_: IpcRendererEvent, progress: any) => callback(progress);
      ipcRenderer.on('backup:progress', listener);
      return () => ipcRenderer.removeListener('backup:progress', listener);
    },

    /**
     * Subscribes to backup completion events
     * @param {Function} callback - Called when backup completes
     * @returns {Function} Cleanup function to remove listener
     */
    onComplete: (callback: (result: any) => void) => {
      const listener = (_: IpcRendererEvent, result: any) => callback(result);
      ipcRenderer.on('backup:complete', listener);
      return () => ipcRenderer.removeListener('backup:complete', listener);
    },

    /**
     * Subscribes to backup error events
     * @param {Function} callback - Called when backup encounters an error
     * @returns {Function} Cleanup function to remove listener
     */
    onError: (callback: (error: { message: string }) => void) => {
      const listener = (_: IpcRendererEvent, error: any) => callback(error);
      ipcRenderer.on('backup:error', listener);
      return () => ipcRenderer.removeListener('backup:error', listener);
    },
  },

  /**
   * ============================================
   * SHELL METHODS
   * ============================================
   * Interaction with system shell and external applications
   */
  shell: {
    /**
     * Opens a URL in the default external browser
     * @param {string} url - URL to open
     * @returns {Promise<{success: boolean, error?: string}>} Open result
     */
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  },
});

/**
 * ============================================
 * LEGACY ELECTRON NAMESPACE
 * ============================================
 * @deprecated - Maintained for backward compatibility with older code
 * New code should use the 'api' namespace above instead
 */
contextBridge.exposeInMainWorld('electron', {
  /**
   * Gets application info (version, name, etc.)
   * @returns {Promise<{version: string, name: string}>} App info
   */
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  /**
   * Gets macOS version information
   * @returns {Promise<{version: string}>} macOS version
   */
  getMacOSVersion: () => ipcRenderer.invoke('get-macos-version'),

  /**
   * Checks if app is in /Applications folder
   * @returns {Promise<{inApplications: boolean, path: string}>} Location check result
   */
  checkAppLocation: () => ipcRenderer.invoke('check-app-location'),

  /**
   * Legacy permission check method
   * @returns {Promise<object>} Permission statuses
   */
  checkPermissions: () => ipcRenderer.invoke('check-permissions'),

  /**
   * Triggers Full Disk Access check
   * @returns {Promise<{granted: boolean}>} Access status
   */
  triggerFullDiskAccess: () => ipcRenderer.invoke('trigger-full-disk-access'),

  /**
   * Legacy permission request method
   * @returns {Promise<object>} Permission request result
   */
  requestPermissions: () => ipcRenderer.invoke('request-permissions'),

  /**
   * Requests contacts permission
   * @returns {Promise<{granted: boolean}>} Permission result
   */
  requestContactsPermission: () => ipcRenderer.invoke('request-contacts-permission'),

  /**
   * Opens macOS System Settings/Preferences
   * @returns {Promise<{success: boolean}>} Open result
   */
  openSystemSettings: () => ipcRenderer.invoke('open-system-settings'),

  /**
   * Gets iMessage conversations from Messages database
   * @returns {Promise<Array>} List of conversations
   */
  getConversations: () => ipcRenderer.invoke('get-conversations'),

  /**
   * Gets messages for a specific chat
   * @param {string} chatId - Chat ID to get messages for
   * @returns {Promise<Array>} List of messages
   */
  getMessages: (chatId: string) => ipcRenderer.invoke('get-messages', chatId),

  /**
   * Exports conversations to text files
   * @param {Array<string>} conversationIds - Array of conversation IDs to export
   * @returns {Promise<{success: boolean, exportPath?: string}>} Export result
   */
  exportConversations: (conversationIds: string[]) => ipcRenderer.invoke('export-conversations', conversationIds),

  /**
   * Opens a folder in Finder
   * @param {string} folderPath - Path to folder to open
   * @returns {Promise<{success: boolean}>} Open result
   */
  openFolder: (folderPath: string) => ipcRenderer.invoke('open-folder', folderPath),

  /**
   * ============================================
   * AUTO-UPDATE EVENT LISTENERS (Legacy)
   * ============================================
   */

  /**
   * Listens for app update availability
   * @param {Function} callback - Callback with update info
   * @returns {Function} Cleanup function
   */
  onUpdateAvailable: (callback: (info: any) => void) => {
    const listener = (_: IpcRendererEvent, info: any) => callback(info);
    ipcRenderer.on('update-available', listener);
    return () => ipcRenderer.removeListener('update-available', listener);
  },

  /**
   * Listens for update download progress
   * @param {Function} callback - Callback with progress info
   * @returns {Function} Cleanup function
   */
  onUpdateProgress: (callback: (progress: any) => void) => {
    const listener = (_: IpcRendererEvent, progress: any) => callback(progress);
    ipcRenderer.on('update-progress', listener);
    return () => ipcRenderer.removeListener('update-progress', listener);
  },

  /**
   * Listens for update download completion
   * @param {Function} callback - Callback with update info
   * @returns {Function} Cleanup function
   */
  onUpdateDownloaded: (callback: (info: any) => void) => {
    const listener = (_: IpcRendererEvent, info: any) => callback(info);
    ipcRenderer.on('update-downloaded', listener);
    return () => ipcRenderer.removeListener('update-downloaded', listener);
  },

  /**
   * Installs downloaded update and restarts app
   * @returns {void}
   */
  installUpdate: () => ipcRenderer.send('install-update'),

  /**
   * ============================================
   * OUTLOOK INTEGRATION METHODS (Legacy)
   * ============================================
   */

  /**
   * Initializes Outlook integration
   * @returns {Promise<{success: boolean}>} Initialization result
   */
  outlookInitialize: () => ipcRenderer.invoke('outlook-initialize'),

  /**
   * Authenticates with Outlook/Microsoft 365
   * @returns {Promise<{success: boolean}>} Authentication result
   */
  outlookAuthenticate: () => ipcRenderer.invoke('outlook-authenticate'),

  /**
   * Checks if user is authenticated with Outlook
   * @returns {Promise<{authenticated: boolean}>} Authentication status
   */
  outlookIsAuthenticated: () => ipcRenderer.invoke('outlook-is-authenticated'),

  /**
   * Gets authenticated user's email address
   * @returns {Promise<{email: string}>} User email
   */
  outlookGetUserEmail: () => ipcRenderer.invoke('outlook-get-user-email'),

  /**
   * Exports emails for specified contacts
   * @param {Array} contacts - Contacts to export emails for
   * @returns {Promise<{success: boolean}>} Export result
   */
  outlookExportEmails: (contacts: any[]) => ipcRenderer.invoke('outlook-export-emails', contacts),

  /**
   * Signs out from Outlook
   * @returns {Promise<{success: boolean}>} Sign out result
   */
  outlookSignout: () => ipcRenderer.invoke('outlook-signout'),

  /**
   * Listens for device code during authentication flow
   * @param {Function} callback - Callback with device code info
   * @returns {Function} Cleanup function
   */
  onDeviceCode: (callback: (info: any) => void) => {
    const listener = (_: IpcRendererEvent, info: any) => callback(info);
    ipcRenderer.on('device-code-received', listener);
    return () => ipcRenderer.removeListener('device-code-received', listener);
  },

  /**
   * Listens for email export progress
   * @param {Function} callback - Callback with progress info
   * @returns {Function} Cleanup function
   */
  onExportProgress: (callback: (progress: any) => void) => {
    const listener = (_: IpcRendererEvent, progress: any) => callback(progress);
    ipcRenderer.on('export-progress', listener);
    return () => ipcRenderer.removeListener('export-progress', listener);
  }
});
