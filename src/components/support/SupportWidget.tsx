/**
 * SupportWidget Component
 * TASK-2180: Floating "?" support button for the desktop Electron app.
 * TASK-2282: Moved outside auth routes so it's visible on ALL screens.
 *
 * Renders a fixed blue circle at the bottom-left of the screen.
 * When clicked, auto-captures a screenshot, collects diagnostics,
 * and opens the SupportTicketDialog.
 *
 * When user is authenticated, auto-fills name/email from session.
 * When unauthenticated, shows name/email input fields in the dialog.
 */

import React, { useState, useCallback, useEffect } from "react";
import { SupportTicketDialog } from "./SupportTicketDialog";

interface SupportWidgetProps {
  /** Optional user email (provided when rendered inside auth context) */
  userEmail?: string;
  /** Optional user display name (provided when rendered inside auth context) */
  userName?: string;
}

/**
 * Floating support widget button with "?" icon.
 * Opens the SupportTicketDialog on click.
 *
 * TASK-2282: Detects auth state internally via IPC when props are not provided.
 * This allows the widget to be rendered outside auth-gated routes.
 */
export function SupportWidget({
  userEmail: propEmail,
  userName: propName,
}: SupportWidgetProps = {}): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [detectedEmail, setDetectedEmail] = useState<string>("");
  const [detectedName, setDetectedName] = useState<string>("");

  // TASK-2282: Try to detect user info via IPC when props not provided
  useEffect(() => {
    if (propEmail && propName) return; // Already have props, skip IPC

    let cancelled = false;

    const detectUser = async () => {
      try {
        const result = await window.api.auth.getCurrentUser();
        if (!cancelled && result.success && result.user) {
          setDetectedEmail(result.user.email || "");
          setDetectedName(result.user.display_name || result.user.email || "");
        }
      } catch {
        // Expected when DB not initialized or no session - widget still works
      }
    };

    detectUser();
    return () => { cancelled = true; };
  }, [propEmail, propName]);

  const userEmail = propEmail || detectedEmail;
  const userName = propName || detectedName;

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
