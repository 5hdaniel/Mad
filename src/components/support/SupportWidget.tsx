/**
 * SupportWidget Component
 * TASK-2180: Floating "?" support button for the desktop Electron app.
 *
 * Renders a fixed blue circle at the bottom-left of the screen.
 * When clicked, auto-captures a screenshot, collects diagnostics,
 * and opens the SupportTicketDialog.
 *
 * Only rendered when the user is authenticated (controlled by AppShell).
 */

import React, { useState, useCallback } from "react";
import { SupportTicketDialog } from "./SupportTicketDialog";

interface SupportWidgetProps {
  /** User email from session */
  userEmail: string;
  /** User display name from session */
  userName: string;
}

/**
 * Floating support widget button with "?" icon.
 * Opens the SupportTicketDialog on click.
 */
export function SupportWidget({
  userEmail,
  userName,
}: SupportWidgetProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <>
      {/* Floating "?" button - bottom-left, blue circle */}
      <button
        onClick={handleOpen}
        className="fixed bottom-4 left-4 z-50 w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center no-drag-region"
        title="Contact Support"
        aria-label="Open support dialog"
      >
        ?
      </button>

      {/* Support Ticket Dialog */}
      {isOpen && (
        <SupportTicketDialog
          onClose={handleClose}
          userEmail={userEmail}
          userName={userName}
          autoCaptureScreenshot
        />
      )}
    </>
  );
}
