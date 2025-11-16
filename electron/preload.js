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
  },

  // IPC event listeners
  onMicrosoftDeviceCode: (callback) => ipcRenderer.on('microsoft:device-code', (_, info) => callback(info)),

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
