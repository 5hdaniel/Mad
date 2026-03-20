// ============================================
// SYSTEM HANDLERS - Compatibility Re-export
// The monolith has been split into 3 domain handler files.
// This file provides backwards compatibility for existing tests.
// ============================================

import { registerDiagnosticHandlers } from "./diagnosticHandlers";
import { registerUserSettingsHandlers } from "./userSettingsHandlers";
import { registerSystemHandlers as registerSystemCoreHandlers } from "./systemHandlers";

/**
 * Register all system-related IPC handlers (delegates to domain files).
 */
export function registerSystemHandlers(): void {
  registerSystemCoreHandlers();
  registerDiagnosticHandlers();
  registerUserSettingsHandlers();
}
