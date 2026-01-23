/**
 * ============================================
 * PRELOAD SCRIPT - IPC BRIDGE
 * ============================================
 * This file safely exposes IPC methods to the renderer process via contextBridge.
 * It acts as a secure bridge between the main process and renderer process.
 *
 * Bridge modules are organized by domain in electron/preload/:
 * - authBridge: Authentication, OAuth, session management
 * - transactionBridge: Real estate transactions, scanning, export
 * - contactBridge: Contacts and address verification
 * - communicationBridge: Feedback for AI learning
 * - settingsBridge: User preferences, shell operations
 * - llmBridge: LLM configuration and usage
 * - systemBridge: Permissions, connections, health checks
 * - deviceBridge: iOS device detection, backup, sync, drivers
 * - outlookBridge: Legacy Outlook integration
 * - eventBridge: Event listeners from main process
 */

import { contextBridge } from "electron";

import {
  authBridge,
  transactionBridge,
  contactBridge,
  addressBridge,
  feedbackBridge,
  preferencesBridge,
  userBridge,
  shellBridge,
  llmBridge,
  systemBridge,
  deviceBridge,
  backupBridge,
  driverBridge,
  syncBridge,
  eventBridge,
  outlookBridge,
  updateBridge,
  messageBridge,
  licenseBridge,
} from "./preload/index";

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
  // Authentication methods
  auth: authBridge,

  // Transaction methods
  transactions: transactionBridge,

  // Contact methods
  contacts: contactBridge,

  // Address verification methods
  address: addressBridge,

  // Feedback methods for AI learning
  feedback: feedbackBridge,

  // User preferences
  preferences: preferencesBridge,

  // LLM configuration
  llm: llmBridge,

  // System operations
  system: systemBridge,

  // User settings
  user: userBridge,

  // Event listeners (spread from eventBridge)
  ...eventBridge,

  // Backup operations
  backup: backupBridge,

  // Shell operations
  shell: shellBridge,

  // Device detection
  device: deviceBridge,

  // Driver management (Windows)
  drivers: driverBridge,

  // Sync operations (Windows iPhone sync)
  sync: syncBridge,

  // Outlook integration (Microsoft 365)
  outlook: outlookBridge,

  // Auto-update functionality
  update: updateBridge,

  // iMessage conversations (macOS)
  messages: messageBridge,

  // License management
  license: licenseBridge,
});
