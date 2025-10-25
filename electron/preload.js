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
  exportConversations: (conversationIds) => ipcRenderer.invoke('export-conversations', conversationIds)
});
