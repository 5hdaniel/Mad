/**
 * Preload Bridge Barrel Export
 * Re-exports all bridge modules for composition in preload.ts
 */

export { authBridge } from "./authBridge";
export { transactionBridge } from "./transactionBridge";
export { contactBridge, addressBridge } from "./contactBridge";
export { feedbackBridge } from "./communicationBridge";
export { preferencesBridge, userBridge, shellBridge } from "./settingsBridge";
export { llmBridge } from "./llmBridge";
export { systemBridge } from "./systemBridge";
export { deviceBridge, backupBridge, driverBridge, syncBridge } from "./deviceBridge";
export { outlookBridge, updateBridge } from "./outlookBridge";
export { eventBridge } from "./eventBridge";
export { messageBridge } from "./messageBridge";

// NOTE: legacyElectronBridge has been deprecated and removed.
// All functionality is now available through the modular bridges above.
