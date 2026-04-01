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
import { usePlatform } from "../../contexts";

/** Detail payload for the 'open-support-widget' custom event (TASK-2319) */
export interface OpenSupportWidgetDetail {
  /** Pre-fill the subject field in the ticket dialog */
  subject?: string;
  /** Pre-fill user email when DB isn't available (e.g., during onboarding errors) */
  email?: string;
  /** Pre-fill user name when DB isn't available */
  name?: string;
}

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
  const { isWindows } = usePlatform();
  const [isOpen, setIsOpen] = useState(false);
  const [detectedEmail, setDetectedEmail] = useState<string>("");
  const [detectedName, setDetectedName] = useState<string>("");

  // TASK-2282: Try to detect user info via IPC when props not provided
  // Also re-detect when widget is opened (user may have logged in since mount)
  useEffect(() => {
    if (propEmail && propName) return; // Already have props, skip IPC
    if (detectedEmail) return; // Already detected, skip

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
  }, [propEmail, propName, isOpen, detectedEmail]);

  const userEmail = propEmail || detectedEmail;
  const userName = propName || detectedName;

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setPrefilledSubject("");
  }, []);

  // TASK-2319: Pre-filled subject for programmatic opens
  const [prefilledSubject, setPrefilledSubject] = useState("");

  // TASK-2319: Listen for 'open-support-widget' custom event so other
  // components (ErrorBoundary, AccountVerificationStep) can open the widget
  // without prop drilling or context.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<OpenSupportWidgetDetail>).detail;
      if (detail?.subject) {
        setPrefilledSubject(detail.subject);
      }
      // Accept email/name from event when DB isn't available (e.g., onboarding errors)
      if (detail?.email && !detectedEmail) {
        setDetectedEmail(detail.email);
      }
      if (detail?.name && !detectedName) {
        setDetectedName(detail.name);
      }
      setIsOpen(true);
    };
    window.addEventListener("open-support-widget", handler);
    return () => window.removeEventListener("open-support-widget", handler);
  }, [detectedEmail, detectedName]);

  return (
    <>
      {/* Floating "?" button - bottom-left, blue circle
           BACKLOG-1341: z-[70] ensures visibility above all modal overlays
           (Settings/Profile/WelcomeTerms use z-50, Transactions/Contacts/Details use z-[60]) */}
      {/* BACKLOG-1554: Windows frameless windows have 20px resize zones at corners
           that intercept clicks. Use bottom-8 left-8 (32px) on Windows to clear the
           resize zone; keep bottom-4 left-4 (16px) on macOS/Linux. */}
      <button
        onClick={handleOpen}
        data-support-widget
        className={`fixed z-[70] w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center no-drag-region ${
          isWindows ? "bottom-8 left-8" : "bottom-4 left-4"
        }`}
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
          prefilledSubject={prefilledSubject}
        />
      )}
    </>
  );
}
