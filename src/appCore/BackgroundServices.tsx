/**
 * BackgroundServices Component
 *
 * Renders background services and monitors that run alongside the main app.
 * These components don't render visible UI but perform background tasks.
 *
 * TASK-1786: Removed useMacOSMessagesImport hook - all sync orchestration
 * is now handled by SyncOrchestratorService via useAutoRefresh hook.
 */

import React from "react";
import UpdateNotification from "../components/UpdateNotification";

export function BackgroundServices() {
  return (
    <>
      {/* Update Notification */}
      <UpdateNotification />
    </>
  );
}
