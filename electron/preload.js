const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Authentication methods
  auth: {
    googleLogin: () => ipcRenderer.invoke('auth:google:login'),
    googleCompleteLogin: (code) => ipcRenderer.invoke('auth:google:complete-login', code),
    microsoftLogin: () => ipcRenderer.invoke('auth:microsoft:login'),
    microsoftCompleteLogin: (code) => ipcRenderer.invoke('auth:microsoft:complete-login', code),
    logout: (sessionToken) => ipcRenderer.invoke('auth:logout', sessionToken),
    validateSession: (sessionToken) => ipcRenderer.invoke('auth:validate-session', sessionToken),
    getCurrentUser: () => ipcRenderer.invoke('auth:get-current-user'),
    acceptTerms: (userId) => ipcRenderer.invoke('auth:accept-terms', userId),
  },

  // Transaction methods
  transactions: {
    scan: (userId, options) => ipcRenderer.invoke('transactions:scan', userId, options),
    getAll: (userId) => ipcRenderer.invoke('transactions:get-all', userId),
    create: (userId, transactionData) => ipcRenderer.invoke('transactions:create', userId, transactionData),
    createAudited: (userId, transactionData) => ipcRenderer.invoke('transactions:create-audited', userId, transactionData),
    getDetails: (transactionId) => ipcRenderer.invoke('transactions:get-details', transactionId),
    getWithContacts: (transactionId) => ipcRenderer.invoke('transactions:get-with-contacts', transactionId),
    update: (transactionId, updates) => ipcRenderer.invoke('transactions:update', transactionId, updates),
    delete: (transactionId) => ipcRenderer.invoke('transactions:delete', transactionId),
    assignContact: (transactionId, contactId, role, roleCategory, isPrimary, notes) =>
      ipcRenderer.invoke('transactions:assign-contact', transactionId, contactId, role, roleCategory, isPrimary, notes),
    removeContact: (transactionId, contactId) => ipcRenderer.invoke('transactions:remove-contact', transactionId, contactId),
    reanalyze: (userId, provider, propertyAddress, dateRange) =>
      ipcRenderer.invoke('transactions:reanalyze', userId, provider, propertyAddress, dateRange),
    exportPDF: (transactionId, outputPath) => ipcRenderer.invoke('transactions:export-pdf', transactionId, outputPath),
    exportEnhanced: (transactionId, options) => ipcRenderer.invoke('transactions:export-enhanced', transactionId, options),
  },

  // Contact methods
  contacts: {
    getAll: (userId) => ipcRenderer.invoke('contacts:get-all', userId),
    getSortedByActivity: (userId, propertyAddress) => ipcRenderer.invoke('contacts:get-sorted-by-activity', userId, propertyAddress),
    create: (userId, contactData) => ipcRenderer.invoke('contacts:create', userId, contactData),
    update: (contactId, updates) => ipcRenderer.invoke('contacts:update', contactId, updates),
    delete: (contactId) => ipcRenderer.invoke('contacts:delete', contactId),
  },

  // Address verification methods (Google Places API)
  address: {
    initialize: (apiKey) => ipcRenderer.invoke('address:initialize', apiKey),
    getSuggestions: (input, sessionToken) => ipcRenderer.invoke('address:get-suggestions', input, sessionToken),
    getDetails: (placeId) => ipcRenderer.invoke('address:get-details', placeId),
    geocode: (address) => ipcRenderer.invoke('address:geocode', address),
    validate: (address) => ipcRenderer.invoke('address:validate', address),
  },

  // User feedback methods (for extraction corrections)
  feedback: {
    submit: (userId, feedbackData) => ipcRenderer.invoke('feedback:submit', userId, feedbackData),
    getForTransaction: (transactionId) => ipcRenderer.invoke('feedback:get-for-transaction', transactionId),
    getMetrics: (userId, fieldName) => ipcRenderer.invoke('feedback:get-metrics', userId, fieldName),
    getSuggestion: (userId, fieldName, extractedValue, confidence) =>
      ipcRenderer.invoke('feedback:get-suggestion', userId, fieldName, extractedValue, confidence),
    getLearningStats: (userId, fieldName) => ipcRenderer.invoke('feedback:get-learning-stats', userId, fieldName),
  },

  // System health and permission checks
  system: {
    // Permission setup (onboarding)
    runPermissionSetup: () => ipcRenderer.invoke('system:run-permission-setup'),
    requestContactsPermission: () => ipcRenderer.invoke('system:request-contacts-permission'),
    setupFullDiskAccess: () => ipcRenderer.invoke('system:setup-full-disk-access'),
    openPrivacyPane: (pane) => ipcRenderer.invoke('system:open-privacy-pane', pane),
    checkFullDiskAccessStatus: () => ipcRenderer.invoke('system:check-full-disk-access-status'),

    // Permission checks
    checkFullDiskAccess: () => ipcRenderer.invoke('system:check-full-disk-access'),
    checkContactsPermission: () => ipcRenderer.invoke('system:check-contacts-permission'),
    checkAllPermissions: () => ipcRenderer.invoke('system:check-all-permissions'),

    // Connection checks
    checkGoogleConnection: (userId) => ipcRenderer.invoke('system:check-google-connection', userId),
    checkMicrosoftConnection: (userId) => ipcRenderer.invoke('system:check-microsoft-connection', userId),
    checkAllConnections: (userId) => ipcRenderer.invoke('system:check-all-connections', userId),

    // Health check
    healthCheck: (userId, provider) => ipcRenderer.invoke('system:health-check', userId, provider),
  },

  // IPC event listeners
  onMicrosoftLoginComplete: (callback) => ipcRenderer.on('microsoft:login-complete', (_, result) => callback(result)),
  onTransactionScanProgress: (callback) => ipcRenderer.on('transactions:scan-progress', (_, progress) => callback(progress)),

  // Shell methods (opens URLs in external browser)
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  },
});

// Legacy electron namespace for backward compatibility
contextBridge.exposeInMainWorld('electron', {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  getMacOSVersion: () => ipcRenderer.invoke('get-macos-version'),
  checkAppLocation: () => ipcRenderer.invoke('check-app-location'),
  checkPermissions: () => ipcRenderer.invoke('check-permissions'),
  triggerFullDiskAccess: () => ipcRenderer.invoke('trigger-full-disk-access'),
  requestPermissions: () => ipcRenderer.invoke('request-permissions'),
  requestContactsPermission: () => ipcRenderer.invoke('request-contacts-permission'),
  openSystemSettings: () => ipcRenderer.invoke('open-system-settings'),
  getConversations: () => ipcRenderer.invoke('get-conversations'),
  getMessages: (chatId) => ipcRenderer.invoke('get-messages', chatId),
  exportConversations: (conversationIds) => ipcRenderer.invoke('export-conversations', conversationIds),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),

  // Auto-update methods
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_, info) => callback(info)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_, progress) => callback(progress)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_, info) => callback(info)),
  installUpdate: () => ipcRenderer.send('install-update'),

  // Outlook integration methods
  outlookInitialize: () => ipcRenderer.invoke('outlook-initialize'),
  outlookAuthenticate: () => ipcRenderer.invoke('outlook-authenticate'),
  outlookIsAuthenticated: () => ipcRenderer.invoke('outlook-is-authenticated'),
  outlookGetUserEmail: () => ipcRenderer.invoke('outlook-get-user-email'),
  outlookExportEmails: (contacts) => ipcRenderer.invoke('outlook-export-emails', contacts),
  outlookSignout: () => ipcRenderer.invoke('outlook-signout'),
  onDeviceCode: (callback) => ipcRenderer.on('device-code-received', (_, info) => callback(info)),
  onExportProgress: (callback) => ipcRenderer.on('export-progress', (_, progress) => callback(progress))
});
