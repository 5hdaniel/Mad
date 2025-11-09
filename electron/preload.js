const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  getMacOSVersion: () => ipcRenderer.invoke('get-macos-version'),
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
  installUpdate: () => ipcRenderer.send('install-update')
});
