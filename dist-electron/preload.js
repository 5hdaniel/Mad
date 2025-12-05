"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('api', {
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
        googleLogin: () => electron_1.ipcRenderer.invoke('auth:google:login'),
        /**
         * Completes Google OAuth login with authorization code
         * @param {string} code - OAuth authorization code from Google
         * @returns {Promise<{success: boolean, user?: object, sessionToken?: string, error?: string}>} Login completion result
         */
        googleCompleteLogin: (code) => electron_1.ipcRenderer.invoke('auth:google:complete-login', code),
        /**
         * Initiates Microsoft OAuth login flow
         * @returns {Promise<{success: boolean, authUrl?: string, error?: string}>} Login initiation result
         */
        microsoftLogin: () => electron_1.ipcRenderer.invoke('auth:microsoft:login'),
        /**
         * Completes Microsoft OAuth login with authorization code
         * @param {string} code - OAuth authorization code from Microsoft
         * @returns {Promise<{success: boolean, user?: object, sessionToken?: string, error?: string}>} Login completion result
         */
        microsoftCompleteLogin: (code) => electron_1.ipcRenderer.invoke('auth:microsoft:complete-login', code),
        /**
         * Connects Google mailbox for a logged-in user
         * @param {string} userId - User ID to connect mailbox for
         * @returns {Promise<{success: boolean, error?: string}>} Connection result
         */
        googleConnectMailbox: (userId) => electron_1.ipcRenderer.invoke('auth:google:connect-mailbox', userId),
        /**
         * Connects Microsoft mailbox for a logged-in user
         * @param {string} userId - User ID to connect mailbox for
         * @returns {Promise<{success: boolean, error?: string}>} Connection result
         */
        microsoftConnectMailbox: (userId) => electron_1.ipcRenderer.invoke('auth:microsoft:connect-mailbox', userId),
        /**
         * Disconnects Google mailbox for a logged-in user
         * @param {string} userId - User ID to disconnect mailbox for
         * @returns {Promise<{success: boolean, error?: string}>} Disconnection result
         */
        googleDisconnectMailbox: (userId) => electron_1.ipcRenderer.invoke('auth:google:disconnect-mailbox', userId),
        /**
         * Disconnects Microsoft mailbox for a logged-in user
         * @param {string} userId - User ID to disconnect mailbox for
         * @returns {Promise<{success: boolean, error?: string}>} Disconnection result
         */
        microsoftDisconnectMailbox: (userId) => electron_1.ipcRenderer.invoke('auth:microsoft:disconnect-mailbox', userId),
        /**
         * Logs out the current user and invalidates session
         * @param {string} sessionToken - Session token to invalidate
         * @returns {Promise<{success: boolean, error?: string}>} Logout result
         */
        logout: (sessionToken) => electron_1.ipcRenderer.invoke('auth:logout', sessionToken),
        /**
         * Validates an existing session token
         * @param {string} sessionToken - Session token to validate
         * @returns {Promise<{valid: boolean, user?: object, error?: string}>} Validation result
         */
        validateSession: (sessionToken) => electron_1.ipcRenderer.invoke('auth:validate-session', sessionToken),
        /**
         * Gets the currently authenticated user
         * @returns {Promise<{success: boolean, user?: object, error?: string}>} Current user data
         */
        getCurrentUser: () => electron_1.ipcRenderer.invoke('auth:get-current-user'),
        /**
         * Records user's acceptance of terms and conditions
         * @param {string} userId - User ID accepting terms
         * @returns {Promise<{success: boolean, error?: string}>} Acceptance result
         */
        acceptTerms: (userId) => electron_1.ipcRenderer.invoke('auth:accept-terms', userId),
        /**
         * Marks email onboarding as completed for a user
         * @param {string} userId - User ID completing email onboarding
         * @returns {Promise<{success: boolean, error?: string}>} Completion result
         */
        completeEmailOnboarding: (userId) => electron_1.ipcRenderer.invoke('auth:complete-email-onboarding', userId),
        /**
         * Checks if user has completed email onboarding
         * @param {string} userId - User ID to check
         * @returns {Promise<{success: boolean, completed: boolean, error?: string}>} Onboarding status
         */
        checkEmailOnboarding: (userId) => electron_1.ipcRenderer.invoke('auth:check-email-onboarding', userId),
        /**
         * Completes a pending login after keychain/database setup
         * Called when OAuth succeeded but database wasn't initialized yet
         * @param {Object} oauthData - The pending OAuth data from login-pending event
         * @returns {Promise<{success: boolean, user?: object, sessionToken?: string, subscription?: object, isNewUser?: boolean, error?: string}>} Login completion result
         */
        completePendingLogin: (oauthData) => electron_1.ipcRenderer.invoke('auth:complete-pending-login', oauthData),
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
        scan: (userId, options) => electron_1.ipcRenderer.invoke('transactions:scan', userId, options),
        /**
         * Retrieves all transactions for a user
         * @param {string} userId - User ID to get transactions for
         * @returns {Promise<{success: boolean, transactions?: Array, error?: string}>} All user transactions
         */
        getAll: (userId) => electron_1.ipcRenderer.invoke('transactions:get-all', userId),
        /**
         * Creates a new manual transaction
         * @param {string} userId - User ID creating the transaction
         * @param {Object} transactionData - Transaction details (address, type, status, dates, etc.)
         * @returns {Promise<{success: boolean, transaction?: object, error?: string}>} Created transaction
         */
        create: (userId, transactionData) => electron_1.ipcRenderer.invoke('transactions:create', userId, transactionData),
        /**
         * Creates a new audited transaction with verified data
         * @param {string} userId - User ID creating the transaction
         * @param {Object} transactionData - Audited transaction details
         * @returns {Promise<{success: boolean, transaction?: object, error?: string}>} Created audited transaction
         */
        createAudited: (userId, transactionData) => electron_1.ipcRenderer.invoke('transactions:create-audited', userId, transactionData),
        /**
         * Gets detailed information for a specific transaction
         * @param {string} transactionId - Transaction ID to retrieve
         * @returns {Promise<{success: boolean, transaction?: object, error?: string}>} Transaction details
         */
        getDetails: (transactionId) => electron_1.ipcRenderer.invoke('transactions:get-details', transactionId),
        /**
         * Gets transaction with all associated contacts
         * @param {string} transactionId - Transaction ID to retrieve
         * @returns {Promise<{success: boolean, transaction?: object, contacts?: Array, error?: string}>} Transaction with contacts
         */
        getWithContacts: (transactionId) => electron_1.ipcRenderer.invoke('transactions:get-with-contacts', transactionId),
        /**
         * Updates transaction details
         * @param {string} transactionId - Transaction ID to update
         * @param {Object} updates - Fields to update (status, dates, address, etc.)
         * @returns {Promise<{success: boolean, transaction?: object, error?: string}>} Updated transaction
         */
        update: (transactionId, updates) => electron_1.ipcRenderer.invoke('transactions:update', transactionId, updates),
        /**
         * Deletes a transaction
         * @param {string} transactionId - Transaction ID to delete
         * @returns {Promise<{success: boolean, error?: string}>} Deletion result
         */
        delete: (transactionId) => electron_1.ipcRenderer.invoke('transactions:delete', transactionId),
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
        assignContact: (transactionId, contactId, role, roleCategory, isPrimary, notes) => electron_1.ipcRenderer.invoke('transactions:assign-contact', transactionId, contactId, role, roleCategory, isPrimary, notes),
        /**
         * Removes a contact from a transaction
         * @param {string} transactionId - Transaction ID
         * @param {string} contactId - Contact ID to remove
         * @returns {Promise<{success: boolean, error?: string}>} Removal result
         */
        removeContact: (transactionId, contactId) => electron_1.ipcRenderer.invoke('transactions:remove-contact', transactionId, contactId),
        /**
         * Re-analyzes emails for a specific property and date range
         * @param {string} userId - User ID
         * @param {string} provider - Email provider (google or microsoft)
         * @param {string} propertyAddress - Property address to search for
         * @param {Object} dateRange - Date range to search within {start, end}
         * @returns {Promise<{success: boolean, newCount?: number, updatedCount?: number, error?: string}>} Re-analysis results
         */
        reanalyze: (userId, provider, propertyAddress, dateRange) => electron_1.ipcRenderer.invoke('transactions:reanalyze', userId, provider, propertyAddress, dateRange),
        /**
         * Exports transaction as PDF to specified path
         * @param {string} transactionId - Transaction ID to export
         * @param {string} outputPath - File path to save PDF
         * @returns {Promise<{success: boolean, filePath?: string, error?: string}>} Export result
         */
        exportPDF: (transactionId, outputPath) => electron_1.ipcRenderer.invoke('transactions:export-pdf', transactionId, outputPath),
        /**
         * Exports transaction with enhanced options (format, included data, etc.)
         * @param {string} transactionId - Transaction ID to export
         * @param {Object} options - Export options (format, includeContacts, includeEmails, etc.)
         * @returns {Promise<{success: boolean, filePath?: string, error?: string}>} Export result
         */
        exportEnhanced: (transactionId, options) => electron_1.ipcRenderer.invoke('transactions:export-enhanced', transactionId, options),
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
        getAll: (userId) => electron_1.ipcRenderer.invoke('contacts:get-all', userId),
        /**
         * Gets contacts available for assignment (not deleted/archived)
         * @param {string} userId - User ID to get available contacts for
         * @returns {Promise<{success: boolean, contacts?: Array, error?: string}>} Available contacts
         */
        getAvailable: (userId) => electron_1.ipcRenderer.invoke('contacts:get-available', userId),
        /**
         * Imports contacts from system address book or external source
         * @param {string} userId - User ID importing contacts
         * @param {Array} contactsToImport - Array of contact objects to import
         * @returns {Promise<{success: boolean, imported?: number, skipped?: number, error?: string}>} Import results
         */
        import: (userId, contactsToImport) => electron_1.ipcRenderer.invoke('contacts:import', userId, contactsToImport),
        /**
         * Gets contacts sorted by activity/relevance for a property
         * @param {string} userId - User ID
         * @param {string} propertyAddress - Property address to find relevant contacts for
         * @returns {Promise<{success: boolean, contacts?: Array, error?: string}>} Sorted contacts
         */
        getSortedByActivity: (userId, propertyAddress) => electron_1.ipcRenderer.invoke('contacts:get-sorted-by-activity', userId, propertyAddress),
        /**
         * Creates a new contact
         * @param {string} userId - User ID creating the contact
         * @param {Object} contactData - Contact details (name, email, phone, company, etc.)
         * @returns {Promise<{success: boolean, contact?: object, error?: string}>} Created contact
         */
        create: (userId, contactData) => electron_1.ipcRenderer.invoke('contacts:create', userId, contactData),
        /**
         * Updates contact details
         * @param {string} contactId - Contact ID to update
         * @param {Object} updates - Fields to update (name, email, phone, etc.)
         * @returns {Promise<{success: boolean, contact?: object, error?: string}>} Updated contact
         */
        update: (contactId, updates) => electron_1.ipcRenderer.invoke('contacts:update', contactId, updates),
        /**
         * Checks if a contact can be deleted (not assigned to transactions)
         * @param {string} contactId - Contact ID to check
         * @returns {Promise<{canDelete: boolean, reason?: string, transactionCount?: number}>} Deletion eligibility
         */
        checkCanDelete: (contactId) => electron_1.ipcRenderer.invoke('contacts:checkCanDelete', contactId),
        /**
         * Deletes a contact (only if not assigned to transactions)
         * @param {string} contactId - Contact ID to delete
         * @returns {Promise<{success: boolean, error?: string}>} Deletion result
         */
        delete: (contactId) => electron_1.ipcRenderer.invoke('contacts:delete', contactId),
        /**
         * Removes a contact (soft delete/archive)
         * @param {string} contactId - Contact ID to remove
         * @returns {Promise<{success: boolean, error?: string}>} Removal result
         */
        remove: (contactId) => electron_1.ipcRenderer.invoke('contacts:remove', contactId),
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
        initialize: (apiKey) => electron_1.ipcRenderer.invoke('address:initialize', apiKey),
        /**
         * Gets address autocomplete suggestions
         * @param {string} input - Partial address input
         * @param {string} sessionToken - Session token for request batching
         * @returns {Promise<{success: boolean, suggestions?: Array, error?: string}>} Address suggestions
         */
        getSuggestions: (input, sessionToken) => electron_1.ipcRenderer.invoke('address:get-suggestions', input, sessionToken),
        /**
         * Gets detailed information for a specific place
         * @param {string} placeId - Google Place ID
         * @returns {Promise<{success: boolean, place?: object, error?: string}>} Place details
         */
        getDetails: (placeId) => electron_1.ipcRenderer.invoke('address:get-details', placeId),
        /**
         * Geocodes an address to coordinates
         * @param {string} address - Address to geocode
         * @returns {Promise<{success: boolean, coordinates?: {lat: number, lng: number}, error?: string}>} Geocoding result
         */
        geocode: (address) => electron_1.ipcRenderer.invoke('address:geocode', address),
        /**
         * Validates and standardizes an address
         * @param {string} address - Address to validate
         * @returns {Promise<{valid: boolean, standardized?: string, components?: object, error?: string}>} Validation result
         */
        validate: (address) => electron_1.ipcRenderer.invoke('address:validate', address),
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
        submit: (userId, feedbackData) => electron_1.ipcRenderer.invoke('feedback:submit', userId, feedbackData),
        /**
         * Gets all feedback entries for a transaction
         * @param {string} transactionId - Transaction ID
         * @returns {Promise<{success: boolean, feedback?: Array, error?: string}>} Transaction feedback
         */
        getForTransaction: (transactionId) => electron_1.ipcRenderer.invoke('feedback:get-for-transaction', transactionId),
        /**
         * Gets accuracy metrics for a specific field
         * @param {string} userId - User ID
         * @param {string} fieldName - Field name to get metrics for (e.g., 'propertyAddress')
         * @returns {Promise<{success: boolean, metrics?: object, error?: string}>} Field metrics
         */
        getMetrics: (userId, fieldName) => electron_1.ipcRenderer.invoke('feedback:get-metrics', userId, fieldName),
        /**
         * Gets AI suggestion based on learning from past feedback
         * @param {string} userId - User ID
         * @param {string} fieldName - Field name
         * @param {any} extractedValue - Currently extracted value
         * @param {number} confidence - Confidence score (0-1)
         * @returns {Promise<{success: boolean, suggestion?: any, confidence?: number, error?: string}>} AI suggestion
         */
        getSuggestion: (userId, fieldName, extractedValue, confidence) => electron_1.ipcRenderer.invoke('feedback:get-suggestion', userId, fieldName, extractedValue, confidence),
        /**
         * Gets learning statistics for a field (accuracy trends, improvement)
         * @param {string} userId - User ID
         * @param {string} fieldName - Field name
         * @returns {Promise<{success: boolean, stats?: object, error?: string}>} Learning stats
         */
        getLearningStats: (userId, fieldName) => electron_1.ipcRenderer.invoke('feedback:get-learning-stats', userId, fieldName),
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
        get: (userId) => electron_1.ipcRenderer.invoke('preferences:get', userId),
        /**
         * Saves all user preferences (overwrites existing)
         * @param {string} userId - User ID
         * @param {Object} preferences - Complete preferences object
         * @returns {Promise<{success: boolean, error?: string}>} Save result
         */
        save: (userId, preferences) => electron_1.ipcRenderer.invoke('preferences:save', userId, preferences),
        /**
         * Updates specific preference fields (merges with existing)
         * @param {string} userId - User ID
         * @param {Object} partialPreferences - Preferences to update
         * @returns {Promise<{success: boolean, preferences?: object, error?: string}>} Update result
         */
        update: (userId, partialPreferences) => electron_1.ipcRenderer.invoke('preferences:update', userId, partialPreferences),
    },
    /**
     * ============================================
     * SYSTEM METHODS
     * ============================================
     * System-level operations including permissions, connections, and health checks
     */
    system: {
        /**
         * Gets secure storage status without triggering keychain prompt
         * Used to check if encryption is already available (user already authorized)
         * @returns {Promise<{success: boolean, available: boolean, platform?: string, guidance?: string, error?: string}>} Status result
         */
        getSecureStorageStatus: () => electron_1.ipcRenderer.invoke('system:get-secure-storage-status'),
        /**
         * Initializes secure storage (triggers keychain prompt on macOS)
         * Should be called after user login and terms acceptance
         * @returns {Promise<{success: boolean, available: boolean, platform?: string, guidance?: string, error?: string}>} Initialization result
         */
        initializeSecureStorage: () => electron_1.ipcRenderer.invoke('system:initialize-secure-storage'),
        /**
         * Checks if the database encryption key store file exists
         * Used to determine if this is a new user (needs secure storage setup) vs returning user
         * @returns {Promise<{success: boolean, hasKeyStore: boolean}>} Key store check result
         */
        hasEncryptionKeyStore: () => electron_1.ipcRenderer.invoke('system:has-encryption-key-store'),
        /**
         * Initializes the database after secure storage setup
         * Should be called after the user has authorized keychain access (new users only)
         * @returns {Promise<{success: boolean, error?: string}>} Database initialization result
         */
        initializeDatabase: () => electron_1.ipcRenderer.invoke('system:initialize-database'),
        /**
         * Checks if the database is initialized and ready for operations
         * Used to determine if we can save user data after OAuth
         * @returns {Promise<{success: boolean, initialized: boolean}>} Database initialization status
         */
        isDatabaseInitialized: () => electron_1.ipcRenderer.invoke('system:is-database-initialized'),
        /**
         * Runs the complete permission setup flow for onboarding
         * @returns {Promise<{success: boolean, error?: string}>} Setup result
         */
        runPermissionSetup: () => electron_1.ipcRenderer.invoke('system:run-permission-setup'),
        /**
         * Requests macOS contacts permission
         * @returns {Promise<{granted: boolean, error?: string}>} Permission request result
         */
        requestContactsPermission: () => electron_1.ipcRenderer.invoke('system:request-contacts-permission'),
        /**
         * Initiates Full Disk Access setup process
         * @returns {Promise<{success: boolean, error?: string}>} Setup result
         */
        setupFullDiskAccess: () => electron_1.ipcRenderer.invoke('system:setup-full-disk-access'),
        /**
         * Opens macOS System Preferences to a specific privacy pane
         * @param {string} pane - Privacy pane identifier (e.g., 'Privacy_AllFiles', 'Privacy_Contacts')
         * @returns {Promise<{success: boolean, error?: string}>} Open result
         */
        openPrivacyPane: (pane) => electron_1.ipcRenderer.invoke('system:open-privacy-pane', pane),
        /**
         * Checks current Full Disk Access status
         * @returns {Promise<{granted: boolean, error?: string}>} Status check result
         */
        checkFullDiskAccessStatus: () => electron_1.ipcRenderer.invoke('system:check-full-disk-access-status'),
        /**
         * Checks if app has Full Disk Access permission
         * @returns {Promise<{granted: boolean, error?: string}>} Permission status
         */
        checkFullDiskAccess: () => electron_1.ipcRenderer.invoke('system:check-full-disk-access'),
        /**
         * Checks if app has Contacts permission
         * @returns {Promise<{granted: boolean, error?: string}>} Permission status
         */
        checkContactsPermission: () => electron_1.ipcRenderer.invoke('system:check-contacts-permission'),
        /**
         * Checks all required system permissions
         * @returns {Promise<{allGranted: boolean, fullDiskAccess: boolean, contacts: boolean, error?: string}>} All permission statuses
         */
        checkAllPermissions: () => electron_1.ipcRenderer.invoke('system:check-all-permissions'),
        /**
         * Checks Google account connection and token validity
         * @param {string} userId - User ID to check
         * @returns {Promise<{connected: boolean, valid: boolean, error?: string}>} Connection status
         */
        checkGoogleConnection: (userId) => electron_1.ipcRenderer.invoke('system:check-google-connection', userId),
        /**
         * Checks Microsoft account connection and token validity
         * @param {string} userId - User ID to check
         * @returns {Promise<{connected: boolean, valid: boolean, error?: string}>} Connection status
         */
        checkMicrosoftConnection: (userId) => electron_1.ipcRenderer.invoke('system:check-microsoft-connection', userId),
        /**
         * Checks all email provider connections
         * @param {string} userId - User ID to check
         * @returns {Promise<{google: object, microsoft: object, error?: string}>} All connection statuses
         */
        checkAllConnections: (userId) => electron_1.ipcRenderer.invoke('system:check-all-connections', userId),
        /**
         * Runs comprehensive health check for a provider
         * @param {string} userId - User ID
         * @param {string} provider - Provider to check ('google' or 'microsoft')
         * @returns {Promise<{healthy: boolean, issues?: Array, error?: string}>} Health check result
         */
        healthCheck: (userId, provider) => electron_1.ipcRenderer.invoke('system:health-check', userId, provider),
        /**
         * Opens support email with pre-filled content
         * @param {string} errorDetails - Optional error details to include
         * @returns {Promise<{success: boolean, error?: string}>} Result
         */
        contactSupport: (errorDetails) => electron_1.ipcRenderer.invoke('system:contact-support', errorDetails),
        /**
         * Gets diagnostic information for support requests
         * @returns {Promise<{success: boolean, diagnostics?: string, error?: string}>} Diagnostic data
         */
        getDiagnostics: () => electron_1.ipcRenderer.invoke('system:get-diagnostics'),
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
    onGoogleLoginComplete: (callback) => {
        const listener = (_, result) => callback(result);
        electron_1.ipcRenderer.on('google:login-complete', listener);
        return () => electron_1.ipcRenderer.removeListener('google:login-complete', listener);
    },
    /**
     * Listens for Google login pending events (OAuth succeeded, needs keychain setup)
     * @param {Function} callback - Callback function to handle pending login data
     * @returns {Function} Cleanup function to remove listener
     */
    onGoogleLoginPending: (callback) => {
        const listener = (_, result) => callback(result);
        electron_1.ipcRenderer.on('google:login-pending', listener);
        return () => electron_1.ipcRenderer.removeListener('google:login-pending', listener);
    },
    /**
     * Listens for Google login cancelled events (user closed popup)
     * @param {Function} callback - Callback function to handle cancellation
     * @returns {Function} Cleanup function to remove listener
     */
    onGoogleLoginCancelled: (callback) => {
        const listener = () => callback();
        electron_1.ipcRenderer.on('google:login-cancelled', listener);
        return () => electron_1.ipcRenderer.removeListener('google:login-cancelled', listener);
    },
    /**
     * Listens for Google mailbox connection events
     * @param {Function} callback - Callback function to handle connection result
     * @returns {Function} Cleanup function to remove listener
     */
    onGoogleMailboxConnected: (callback) => {
        const listener = (_, result) => callback(result);
        electron_1.ipcRenderer.on('google:mailbox-connected', listener);
        return () => electron_1.ipcRenderer.removeListener('google:mailbox-connected', listener);
    },
    /**
     * Listens for Google mailbox connection cancelled events (user closed popup)
     * @param {Function} callback - Callback function to handle cancellation
     * @returns {Function} Cleanup function to remove listener
     */
    onGoogleMailboxCancelled: (callback) => {
        const listener = () => callback();
        electron_1.ipcRenderer.on('google:mailbox-cancelled', listener);
        return () => electron_1.ipcRenderer.removeListener('google:mailbox-cancelled', listener);
    },
    /**
     * Listens for Microsoft login completion events
     * @param {Function} callback - Callback function to handle login result
     * @returns {Function} Cleanup function to remove listener
     */
    onMicrosoftLoginComplete: (callback) => {
        const listener = (_, result) => callback(result);
        electron_1.ipcRenderer.on('microsoft:login-complete', listener);
        return () => electron_1.ipcRenderer.removeListener('microsoft:login-complete', listener);
    },
    /**
     * Listens for Microsoft login pending events (OAuth succeeded, needs keychain setup)
     * @param {Function} callback - Callback function to handle pending login data
     * @returns {Function} Cleanup function to remove listener
     */
    onMicrosoftLoginPending: (callback) => {
        const listener = (_, result) => callback(result);
        electron_1.ipcRenderer.on('microsoft:login-pending', listener);
        return () => electron_1.ipcRenderer.removeListener('microsoft:login-pending', listener);
    },
    /**
     * Listens for Microsoft login cancelled events (user closed popup)
     * @param {Function} callback - Callback function to handle cancellation
     * @returns {Function} Cleanup function to remove listener
     */
    onMicrosoftLoginCancelled: (callback) => {
        const listener = () => callback();
        electron_1.ipcRenderer.on('microsoft:login-cancelled', listener);
        return () => electron_1.ipcRenderer.removeListener('microsoft:login-cancelled', listener);
    },
    /**
     * Listens for Microsoft mailbox connection events
     * @param {Function} callback - Callback function to handle connection result
     * @returns {Function} Cleanup function to remove listener
     */
    onMicrosoftMailboxConnected: (callback) => {
        const listener = (_, result) => callback(result);
        electron_1.ipcRenderer.on('microsoft:mailbox-connected', listener);
        return () => electron_1.ipcRenderer.removeListener('microsoft:mailbox-connected', listener);
    },
    /**
     * Listens for Microsoft mailbox connection cancelled events (user closed popup)
     * @param {Function} callback - Callback function to handle cancellation
     * @returns {Function} Cleanup function to remove listener
     */
    onMicrosoftMailboxCancelled: (callback) => {
        const listener = () => callback();
        electron_1.ipcRenderer.on('microsoft:mailbox-cancelled', listener);
        return () => electron_1.ipcRenderer.removeListener('microsoft:mailbox-cancelled', listener);
    },
    /**
     * Listens for Google mailbox disconnection events
     * @param {Function} callback - Callback function to handle disconnection result
     * @returns {Function} Cleanup function to remove listener
     */
    onGoogleMailboxDisconnected: (callback) => {
        const listener = (_, result) => callback(result);
        electron_1.ipcRenderer.on('google:mailbox-disconnected', listener);
        return () => electron_1.ipcRenderer.removeListener('google:mailbox-disconnected', listener);
    },
    /**
     * Listens for Microsoft mailbox disconnection events
     * @param {Function} callback - Callback function to handle disconnection result
     * @returns {Function} Cleanup function to remove listener
     */
    onMicrosoftMailboxDisconnected: (callback) => {
        const listener = (_, result) => callback(result);
        electron_1.ipcRenderer.on('microsoft:mailbox-disconnected', listener);
        return () => electron_1.ipcRenderer.removeListener('microsoft:mailbox-disconnected', listener);
    },
    /**
     * Listens for transaction scan progress updates
     * @param {Function} callback - Callback function to handle progress updates
     * @returns {Function} Cleanup function to remove listener
     */
    onTransactionScanProgress: (callback) => {
        const listener = (_, progress) => callback(progress);
        electron_1.ipcRenderer.on('transactions:scan-progress', listener);
        return () => electron_1.ipcRenderer.removeListener('transactions:scan-progress', listener);
    },
    /**
     * Listens for backup progress updates
     * @param {Function} callback - Callback function to handle progress updates
     * @returns {Function} Cleanup function to remove listener
     */
    onBackupProgress: (callback) => {
        const listener = (_, progress) => callback(progress);
        electron_1.ipcRenderer.on('backup:progress', listener);
        return () => electron_1.ipcRenderer.removeListener('backup:progress', listener);
    },
    /**
     * Listens for backup password required events
     * @param {Function} callback - Callback function when password is needed
     * @returns {Function} Cleanup function to remove listener
     */
    onBackupPasswordRequired: (callback) => {
        const listener = (_, data) => callback(data);
        electron_1.ipcRenderer.on('backup:password-required', listener);
        return () => electron_1.ipcRenderer.removeListener('backup:password-required', listener);
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
        getCapabilities: () => electron_1.ipcRenderer.invoke('backup:capabilities'),
        /**
         * Gets current backup status
         * @returns {Promise<BackupStatus>} Current status including progress
         */
        getStatus: () => electron_1.ipcRenderer.invoke('backup:status'),
        /**
         * Starts a backup operation for the specified device
         * @param {BackupOptions} options - Backup options including device UDID
         * @returns {Promise<BackupResult>} Backup result
         */
        start: (options) => electron_1.ipcRenderer.invoke('backup:start', options),
        /**
         * Cancels an in-progress backup
         * @returns {Promise<{success: boolean}>} Cancellation result
         */
        cancel: () => electron_1.ipcRenderer.invoke('backup:cancel'),
        /**
         * Lists all existing backups
         * @returns {Promise<BackupInfo[]>} List of backup information
         */
        list: () => electron_1.ipcRenderer.invoke('backup:list'),
        /**
         * Deletes a specific backup
         * @param {string} backupPath - Path to the backup to delete
         * @returns {Promise<{success: boolean, error?: string}>} Deletion result
         */
        delete: (backupPath) => electron_1.ipcRenderer.invoke('backup:delete', backupPath),
        /**
         * Cleans up old backups, keeping only the most recent
         * @param {number} keepCount - Number of backups to keep per device
         * @returns {Promise<{success: boolean, error?: string}>} Cleanup result
         */
        cleanup: (keepCount) => electron_1.ipcRenderer.invoke('backup:cleanup', keepCount),
        /**
         * Check if a device requires encrypted backup
         * @param {string} udid - Device unique identifier
         * @returns {Promise<{success: boolean, isEncrypted?: boolean, needsPassword?: boolean, error?: string}>}
         */
        checkEncryption: (udid) => electron_1.ipcRenderer.invoke('backup:check-encryption', udid),
        /**
         * Start a backup with password (for encrypted backups)
         * @param {Object} options - Backup options including password
         * @returns {Promise<{success: boolean, backupPath?: string, error?: string, errorCode?: string}>}
         */
        startWithPassword: (options) => electron_1.ipcRenderer.invoke('backup:start-with-password', options),
        /**
         * Verify a backup password without starting backup
         * @param {string} backupPath - Path to the backup
         * @param {string} password - Password to verify
         * @returns {Promise<{success: boolean, valid?: boolean, error?: string}>}
         */
        verifyPassword: (backupPath, password) => electron_1.ipcRenderer.invoke('backup:verify-password', backupPath, password),
        /**
         * Check if an existing backup is encrypted
         * @param {string} backupPath - Path to the backup
         * @returns {Promise<{success: boolean, isEncrypted?: boolean, error?: string}>}
         */
        isEncrypted: (backupPath) => electron_1.ipcRenderer.invoke('backup:is-encrypted', backupPath),
        /**
         * Subscribes to backup progress updates
         * @param {Function} callback - Called with progress updates
         * @returns {Function} Cleanup function to remove listener
         */
        onProgress: (callback) => {
            const listener = (_, progress) => callback(progress);
            electron_1.ipcRenderer.on('backup:progress', listener);
            return () => electron_1.ipcRenderer.removeListener('backup:progress', listener);
        },
        /**
         * Subscribes to backup completion events
         * @param {Function} callback - Called when backup completes
         * @returns {Function} Cleanup function to remove listener
         */
        onComplete: (callback) => {
            const listener = (_, result) => callback(result);
            electron_1.ipcRenderer.on('backup:complete', listener);
            return () => electron_1.ipcRenderer.removeListener('backup:complete', listener);
        },
        /**
         * Subscribes to backup error events
         * @param {Function} callback - Called when backup encounters an error
         * @returns {Function} Cleanup function to remove listener
         */
        onError: (callback) => {
            const listener = (_, error) => callback(error);
            electron_1.ipcRenderer.on('backup:error', listener);
            return () => electron_1.ipcRenderer.removeListener('backup:error', listener);
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
        openExternal: (url) => electron_1.ipcRenderer.invoke('shell:open-external', url),
    },
    /**
     * ============================================
     * DEVICE DETECTION METHODS
     * ============================================
     * Handles iOS device detection via USB using libimobiledevice
     */
    device: {
        /**
         * Lists all currently connected iOS devices
         * @returns {Promise<{success: boolean, devices?: Array, error?: string}>} List of connected devices
         */
        list: () => electron_1.ipcRenderer.invoke('device:list'),
        /**
         * Starts device detection polling
         * @returns {Promise<{success: boolean, error?: string}>} Start result
         */
        startDetection: () => electron_1.ipcRenderer.invoke('device:start-detection'),
        /**
         * Stops device detection polling
         * @returns {Promise<{success: boolean, error?: string}>} Stop result
         */
        stopDetection: () => electron_1.ipcRenderer.invoke('device:stop-detection'),
        /**
         * Checks if libimobiledevice tools are available
         * @returns {Promise<{success: boolean, available?: boolean, error?: string}>} Availability check result
         */
        checkAvailability: () => electron_1.ipcRenderer.invoke('device:check-availability'),
        /**
         * Subscribes to device connected events
         * @param {Function} callback - Callback function when device connects
         * @returns {Function} Cleanup function to remove listener
         */
        onConnected: (callback) => {
            const listener = (_, device) => callback(device);
            electron_1.ipcRenderer.on('device:connected', listener);
            return () => electron_1.ipcRenderer.removeListener('device:connected', listener);
        },
        /**
         * Subscribes to device disconnected events
         * @param {Function} callback - Callback function when device disconnects
         * @returns {Function} Cleanup function to remove listener
         */
        onDisconnected: (callback) => {
            const listener = (_, device) => callback(device);
            electron_1.ipcRenderer.on('device:disconnected', listener);
            return () => electron_1.ipcRenderer.removeListener('device:disconnected', listener);
        },
    },
    /**
     * ============================================
     * APPLE DRIVER METHODS (Windows only)
     * ============================================
     * Detects and installs Apple Mobile Device Support drivers
     */
    drivers: {
        /**
         * Check if Apple Mobile Device Support drivers are installed
         * @returns {Promise<{isInstalled: boolean, version: string|null, serviceRunning: boolean, error: string|null}>}
         */
        checkApple: () => electron_1.ipcRenderer.invoke('drivers:check-apple'),
        /**
         * Check if bundled Apple drivers are available in the app
         * @returns {Promise<{available: boolean}>}
         */
        hasBundled: () => electron_1.ipcRenderer.invoke('drivers:has-bundled'),
        /**
         * Install Apple Mobile Device Support drivers
         * IMPORTANT: Only call after user has given consent
         * @returns {Promise<{success: boolean, error: string|null, rebootRequired: boolean}>}
         */
        installApple: () => electron_1.ipcRenderer.invoke('drivers:install-apple'),
        /**
         * Open iTunes in Microsoft Store for manual installation
         * @returns {Promise<{success: boolean, error?: string}>}
         */
        openITunesStore: () => electron_1.ipcRenderer.invoke('drivers:open-itunes-store'),
    },
    /**
     * ============================================
     * SYNC METHODS (Windows iPhone Sync)
     * ============================================
     * Complete iPhone sync flow: backup -> decrypt -> parse -> resolve
     */
    sync: {
        /**
         * Starts a complete sync operation for an iPhone
         * @param {Object} options - Sync options
         * @param {string} options.udid - Device UDID to sync
         * @param {string} [options.password] - Password for encrypted backups
         * @param {boolean} [options.forceFullBackup] - Force full backup (no incremental)
         * @returns {Promise<SyncResult>} Sync result with messages, contacts, conversations
         */
        start: (options) => electron_1.ipcRenderer.invoke('sync:start', options),
        /**
         * Cancels an in-progress sync operation
         * @returns {Promise<{success: boolean}>} Cancellation result
         */
        cancel: () => electron_1.ipcRenderer.invoke('sync:cancel'),
        /**
         * Gets current sync status
         * @returns {Promise<{isRunning: boolean, phase: string}>} Current sync status
         */
        getStatus: () => electron_1.ipcRenderer.invoke('sync:status'),
        /**
         * Gets all connected iOS devices
         * @returns {Promise<Array>} List of connected devices
         */
        getDevices: () => electron_1.ipcRenderer.invoke('sync:devices'),
        /**
         * Starts device detection polling
         * @param {number} [intervalMs] - Polling interval in milliseconds
         * @returns {Promise<{success: boolean}>} Start result
         */
        startDetection: (intervalMs) => electron_1.ipcRenderer.invoke('sync:start-detection', intervalMs),
        /**
         * Stops device detection polling
         * @returns {Promise<{success: boolean}>} Stop result
         */
        stopDetection: () => electron_1.ipcRenderer.invoke('sync:stop-detection'),
        /**
         * Subscribes to sync progress updates
         * @param {Function} callback - Callback with progress info
         * @returns {Function} Cleanup function to remove listener
         */
        onProgress: (callback) => {
            const listener = (_, progress) => callback(progress);
            electron_1.ipcRenderer.on('sync:progress', listener);
            return () => electron_1.ipcRenderer.removeListener('sync:progress', listener);
        },
        /**
         * Subscribes to sync phase changes
         * @param {Function} callback - Callback with phase name
         * @returns {Function} Cleanup function to remove listener
         */
        onPhase: (callback) => {
            const listener = (_, phase) => callback(phase);
            electron_1.ipcRenderer.on('sync:phase', listener);
            return () => electron_1.ipcRenderer.removeListener('sync:phase', listener);
        },
        /**
         * Subscribes to device connected events during sync
         * @param {Function} callback - Callback with device info
         * @returns {Function} Cleanup function to remove listener
         */
        onDeviceConnected: (callback) => {
            const listener = (_, device) => callback(device);
            electron_1.ipcRenderer.on('sync:device-connected', listener);
            return () => electron_1.ipcRenderer.removeListener('sync:device-connected', listener);
        },
        /**
         * Subscribes to device disconnected events during sync
         * @param {Function} callback - Callback with device info
         * @returns {Function} Cleanup function to remove listener
         */
        onDeviceDisconnected: (callback) => {
            const listener = (_, device) => callback(device);
            electron_1.ipcRenderer.on('sync:device-disconnected', listener);
            return () => electron_1.ipcRenderer.removeListener('sync:device-disconnected', listener);
        },
        /**
         * Subscribes to password required events (encrypted backup)
         * @param {Function} callback - Callback when password is needed
         * @returns {Function} Cleanup function to remove listener
         */
        onPasswordRequired: (callback) => {
            const listener = () => callback();
            electron_1.ipcRenderer.on('sync:password-required', listener);
            return () => electron_1.ipcRenderer.removeListener('sync:password-required', listener);
        },
        /**
         * Subscribes to sync error events
         * @param {Function} callback - Callback with error info
         * @returns {Function} Cleanup function to remove listener
         */
        onError: (callback) => {
            const listener = (_, error) => callback(error);
            electron_1.ipcRenderer.on('sync:error', listener);
            return () => electron_1.ipcRenderer.removeListener('sync:error', listener);
        },
        /**
         * Subscribes to sync completion events
         * @param {Function} callback - Callback with sync result
         * @returns {Function} Cleanup function to remove listener
         */
        onComplete: (callback) => {
            const listener = (_, result) => callback(result);
            electron_1.ipcRenderer.on('sync:complete', listener);
            return () => electron_1.ipcRenderer.removeListener('sync:complete', listener);
        },
    },
});
/**
 * ============================================
 * LEGACY ELECTRON NAMESPACE
 * ============================================
 * @deprecated - Maintained for backward compatibility with older code
 * New code should use the 'api' namespace above instead
 */
electron_1.contextBridge.exposeInMainWorld('electron', {
    /**
     * Current platform identifier from Node.js process.platform
     * @type {'darwin' | 'win32' | 'linux'}
     */
    platform: process.platform,
    /**
     * Gets application info (version, name, etc.)
     * @returns {Promise<{version: string, name: string}>} App info
     */
    getAppInfo: () => electron_1.ipcRenderer.invoke('get-app-info'),
    /**
     * Gets macOS version information
     * @returns {Promise<{version: string}>} macOS version
     */
    getMacOSVersion: () => electron_1.ipcRenderer.invoke('get-macos-version'),
    /**
     * Checks if app is in /Applications folder
     * @returns {Promise<{inApplications: boolean, path: string}>} Location check result
     */
    checkAppLocation: () => electron_1.ipcRenderer.invoke('check-app-location'),
    /**
     * Legacy permission check method
     * @returns {Promise<object>} Permission statuses
     */
    checkPermissions: () => electron_1.ipcRenderer.invoke('check-permissions'),
    /**
     * Triggers Full Disk Access check
     * @returns {Promise<{granted: boolean}>} Access status
     */
    triggerFullDiskAccess: () => electron_1.ipcRenderer.invoke('trigger-full-disk-access'),
    /**
     * Legacy permission request method
     * @returns {Promise<object>} Permission request result
     */
    requestPermissions: () => electron_1.ipcRenderer.invoke('request-permissions'),
    /**
     * Requests contacts permission
     * @returns {Promise<{granted: boolean}>} Permission result
     */
    requestContactsPermission: () => electron_1.ipcRenderer.invoke('request-contacts-permission'),
    /**
     * Opens macOS System Settings/Preferences
     * @returns {Promise<{success: boolean}>} Open result
     */
    openSystemSettings: () => electron_1.ipcRenderer.invoke('open-system-settings'),
    /**
     * Gets iMessage conversations from Messages database
     * @returns {Promise<Array>} List of conversations
     */
    getConversations: () => electron_1.ipcRenderer.invoke('get-conversations'),
    /**
     * Gets messages for a specific chat
     * @param {string} chatId - Chat ID to get messages for
     * @returns {Promise<Array>} List of messages
     */
    getMessages: (chatId) => electron_1.ipcRenderer.invoke('get-messages', chatId),
    /**
     * Exports conversations to text files
     * @param {Array<string>} conversationIds - Array of conversation IDs to export
     * @returns {Promise<{success: boolean, exportPath?: string}>} Export result
     */
    exportConversations: (conversationIds) => electron_1.ipcRenderer.invoke('export-conversations', conversationIds),
    /**
     * Opens a folder in Finder
     * @param {string} folderPath - Path to folder to open
     * @returns {Promise<{success: boolean}>} Open result
     */
    openFolder: (folderPath) => electron_1.ipcRenderer.invoke('open-folder', folderPath),
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
    onUpdateAvailable: (callback) => {
        const listener = (_, info) => callback(info);
        electron_1.ipcRenderer.on('update-available', listener);
        return () => electron_1.ipcRenderer.removeListener('update-available', listener);
    },
    /**
     * Listens for update download progress
     * @param {Function} callback - Callback with progress info
     * @returns {Function} Cleanup function
     */
    onUpdateProgress: (callback) => {
        const listener = (_, progress) => callback(progress);
        electron_1.ipcRenderer.on('update-progress', listener);
        return () => electron_1.ipcRenderer.removeListener('update-progress', listener);
    },
    /**
     * Listens for update download completion
     * @param {Function} callback - Callback with update info
     * @returns {Function} Cleanup function
     */
    onUpdateDownloaded: (callback) => {
        const listener = (_, info) => callback(info);
        electron_1.ipcRenderer.on('update-downloaded', listener);
        return () => electron_1.ipcRenderer.removeListener('update-downloaded', listener);
    },
    /**
     * Installs downloaded update and restarts app
     * @returns {void}
     */
    installUpdate: () => electron_1.ipcRenderer.send('install-update'),
    /**
     * ============================================
     * OUTLOOK INTEGRATION METHODS (Legacy)
     * ============================================
     */
    /**
     * Initializes Outlook integration
     * @returns {Promise<{success: boolean}>} Initialization result
     */
    outlookInitialize: () => electron_1.ipcRenderer.invoke('outlook-initialize'),
    /**
     * Authenticates with Outlook/Microsoft 365
     * @returns {Promise<{success: boolean}>} Authentication result
     */
    outlookAuthenticate: () => electron_1.ipcRenderer.invoke('outlook-authenticate'),
    /**
     * Checks if user is authenticated with Outlook
     * @returns {Promise<{authenticated: boolean}>} Authentication status
     */
    outlookIsAuthenticated: () => electron_1.ipcRenderer.invoke('outlook-is-authenticated'),
    /**
     * Gets authenticated user's email address
     * @returns {Promise<{email: string}>} User email
     */
    outlookGetUserEmail: () => electron_1.ipcRenderer.invoke('outlook-get-user-email'),
    /**
     * Exports emails for specified contacts
     * @param {Array} contacts - Contacts to export emails for
     * @returns {Promise<{success: boolean}>} Export result
     */
    outlookExportEmails: (contacts) => electron_1.ipcRenderer.invoke('outlook-export-emails', contacts),
    /**
     * Signs out from Outlook
     * @returns {Promise<{success: boolean}>} Sign out result
     */
    outlookSignout: () => electron_1.ipcRenderer.invoke('outlook-signout'),
    /**
     * Listens for device code during authentication flow
     * @param {Function} callback - Callback with device code info
     * @returns {Function} Cleanup function
     */
    onDeviceCode: (callback) => {
        const listener = (_, info) => callback(info);
        electron_1.ipcRenderer.on('device-code-received', listener);
        return () => electron_1.ipcRenderer.removeListener('device-code-received', listener);
    },
    /**
     * Listens for email export progress
     * @param {Function} callback - Callback with progress info
     * @returns {Function} Cleanup function
     */
    onExportProgress: (callback) => {
        const listener = (_, progress) => callback(progress);
        electron_1.ipcRenderer.on('export-progress', listener);
        return () => electron_1.ipcRenderer.removeListener('export-progress', listener);
    }
});
