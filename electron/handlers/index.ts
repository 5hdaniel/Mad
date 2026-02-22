// ============================================
// HANDLERS BARREL EXPORT
// Central export for all extracted IPC handlers
// ============================================

// Permission and system handlers
export { registerPermissionHandlers } from "./permissionHandlers";
export { registerConversationHandlers } from "./conversationHandlers";
export { registerMessageImportHandlers } from "./messageImportHandlers";
export { registerOutlookHandlers, getOutlookService } from "./outlookHandlers";
export { registerUpdaterHandlers } from "./updaterHandlers";

// Google OAuth handlers
export {
  registerGoogleAuthHandlers,
  handleGoogleLogin,
  handleGoogleCompleteLogin,
  handleGoogleConnectMailbox,
  handleGoogleConnectMailboxPending,
} from "./googleAuthHandlers";

// Microsoft OAuth handlers
export {
  registerMicrosoftAuthHandlers,
  handleMicrosoftLogin,
  handleMicrosoftConnectMailbox,
  handleMicrosoftConnectMailboxPending,
} from "./microsoftAuthHandlers";

// Session handlers
export { registerSessionHandlers } from "./sessionHandlers";

// Error logging handlers
export { registerErrorLoggingHandlers } from "./errorLoggingHandlers";

// Reset handlers (TASK-1802)
export { registerResetHandlers } from "./resetHandlers";

// CCPA data export handlers (TASK-2053)
export { registerCcpaHandlers } from "./ccpaHandlers";

// Shared auth handlers
export {
  registerSharedAuthHandlers,
  handleCompletePendingLogin,
  handleSavePendingMailboxTokens,
  handleDisconnectMailbox,
} from "./sharedAuthHandlers";
