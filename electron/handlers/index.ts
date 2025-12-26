// ============================================
// HANDLERS BARREL EXPORT
// Central export for all extracted IPC handlers
// ============================================

// Permission and system handlers
export { registerPermissionHandlers } from "./permissionHandlers";
export { registerConversationHandlers } from "./conversationHandlers";
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

// Shared auth handlers
export {
  registerSharedAuthHandlers,
  handleCompletePendingLogin,
  handleSavePendingMailboxTokens,
  handleDisconnectMailbox,
} from "./sharedAuthHandlers";
