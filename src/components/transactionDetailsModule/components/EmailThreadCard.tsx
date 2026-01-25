/**
 * EmailThreadCard Component
 * TASK-1183: Container for an email conversation thread, displaying a header with subject and participants.
 * Clicking "View" opens the email thread in a modal.
 * Pattern follows MessageThreadCard for consistency.
 */
import React, { useState } from "react";
import type { Communication } from "../types";
import { EmailThreadViewModal } from "./modals";

/**
 * Email thread data structure for grouping emails into conversations
 */
export interface EmailThread {
  /** Thread identifier (email_thread_id, thread_id, or generated from subject) */
  id: string;
  /** Thread subject (normalized, without Re:/Fwd: prefixes) */
  subject: string;
  /** All unique participants (from, to, cc) */
  participants: string[];
  /** Number of emails in the thread */
  emailCount: number;
  /** Date of first email */
  startDate: Date;
  /** Date of most recent email */
  endDate: Date;
  /** All emails in the thread, sorted chronologically */
  emails: Communication[];
}

export interface EmailThreadCardProps {
  /** The email thread to display */
  thread: EmailThread;
  /** Callback when an email is clicked for full view */
  onViewEmail?: (email: Communication) => void;
  /** Callback when unlink button is clicked */
  onUnlink?: (thread: EmailThread) => void;
  /** Whether the unlink action is in progress */
  isUnlinking?: boolean;
}

/**
 * Get initials for avatar display from sender name/email.
 */
function getAvatarInitial(sender?: string): string {
  if (!sender) return "?";

  // Try to get name from email format "Name <email@example.com>"
  const nameMatch = sender.match(/^([^<]+)/);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (name && name !== sender) {
      return name.charAt(0).toUpperCase();
    }
  }

  // Extract first character from email before @
  const atIndex = sender.indexOf("@");
  if (atIndex > 0) {
    return sender.charAt(0).toUpperCase();
  }

  return sender.charAt(0).toUpperCase();
}

/**
 * Format participant list for display (show first few, then "+X more")
 */
function formatParticipants(participants: string[], maxShow: number = 2): string {
  if (participants.length === 0) return "Unknown";

  // Extract names from email addresses where possible
  const names = participants.map(p => {
    const nameMatch = p.match(/^([^<]+)/);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      if (name && name !== p) return name;
    }
    // Return email part before @
    const atIndex = p.indexOf("@");
    return atIndex > 0 ? p.substring(0, atIndex) : p;
  });

  // Deduplicate
  const unique = [...new Set(names)];

  if (unique.length <= maxShow) {
    return unique.join(", ");
  }
  return `${unique.slice(0, maxShow).join(", ")} +${unique.length - maxShow}`;
}

/**
 * Format date range for display
 */
function formatDateRange(startDate: Date, endDate: Date): string {
  const formatDate = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  if (startDate.toDateString() === endDate.toDateString()) {
    return formatDate(startDate);
  }
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

/**
 * EmailThreadCard component for displaying an email thread.
 * Compact layout with subject, participant count, and date range.
 */
export function EmailThreadCard({
  thread,
  onViewEmail,
  onUnlink,
  isUnlinking = false,
}: EmailThreadCardProps): React.ReactElement {
  const [showModal, setShowModal] = useState(false);

  const firstEmail = thread.emails[0];
  const avatarInitial = getAvatarInitial(firstEmail?.sender);
  const isMultipleEmails = thread.emailCount > 1;

  return (
    <>
      <div
        className="bg-white rounded-lg border border-gray-200 mb-3 overflow-hidden hover:bg-gray-50 transition-colors"
        data-testid="email-thread-card"
        data-thread-id={thread.id}
      >
        {/* Compact single-line layout */}
        <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Avatar - Blue for email */}
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {avatarInitial}
            </div>

            {/* Thread info: Subject and participants */}
            <div className="min-w-0 flex-1">
              <div data-testid="thread-subject">
                <span className="font-semibold text-gray-900 block truncate">
                  {thread.subject || "(No Subject)"}
                </span>
                <span className="font-normal text-gray-500 text-sm block truncate">
                  {formatParticipants(thread.participants)}
                  {isMultipleEmails && (
                    <span className="ml-2 text-gray-400">
                      ({thread.emailCount} emails)
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Date range and action buttons */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <span className="text-sm text-gray-500 hidden sm:inline">
              {formatDateRange(thread.startDate, thread.endDate)}
            </span>
            <button
              onClick={() => setShowModal(true)}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap"
              data-testid="view-thread-button"
            >
              {isMultipleEmails ? "View Thread" : "View"} &rarr;
            </button>
            {onUnlink && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUnlink(thread);
                }}
                disabled={isUnlinking}
                className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded p-1 transition-all disabled:opacity-50"
                title="Remove from transaction"
                data-testid="unlink-thread-button"
              >
                {isUnlinking ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Email Thread View Modal */}
      {showModal && (
        <EmailThreadViewModal
          thread={thread}
          onClose={() => setShowModal(false)}
          onViewEmail={onViewEmail}
        />
      )}
    </>
  );
}

// ============================================
// EMAIL THREADING UTILITIES
// ============================================

/**
 * Normalize email subject for thread grouping.
 * Removes common reply/forward prefixes: Re:, Fwd:, FW:, RE:, etc.
 */
export function normalizeSubject(subject: string | undefined | null): string {
  if (!subject) return "";

  // Remove Re:, Fwd:, FW:, RE:, Fw: prefixes (case-insensitive, can be repeated)
  let normalized = subject.trim();
  const prefixPattern = /^(re:|fwd:|fw:)\s*/i;

  while (prefixPattern.test(normalized)) {
    normalized = normalized.replace(prefixPattern, "").trim();
  }

  return normalized.toLowerCase();
}

/**
 * Extract sender email address (without name part) for participant deduplication.
 */
function extractEmail(emailString: string): string {
  // Format: "Name <email@example.com>" or just "email@example.com"
  const match = emailString.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : emailString.toLowerCase().trim();
}

/**
 * Get all unique participants from an email (from, to, cc).
 */
function getEmailParticipants(email: Communication): string[] {
  const participants = new Set<string>();

  if (email.sender) {
    participants.add(email.sender);
  }

  if (email.recipients) {
    // Recipients can be comma-separated
    email.recipients.split(",").forEach(r => {
      const trimmed = r.trim();
      if (trimmed) participants.add(trimmed);
    });
  }

  if (email.cc) {
    email.cc.split(",").forEach(c => {
      const trimmed = c.trim();
      if (trimmed) participants.add(trimmed);
    });
  }

  return Array.from(participants);
}

/**
 * Generate a thread key for grouping emails.
 * Priority:
 * 1. email_thread_id (from provider, e.g., Gmail thread ID)
 * 2. thread_id (from messages table join)
 * 3. Normalized subject (fallback)
 */
function getEmailThreadKey(email: Communication): string {
  // Use provider thread ID if available
  if (email.email_thread_id) {
    return `provider-${email.email_thread_id}`;
  }

  // Use thread_id from messages join if available
  if (email.thread_id) {
    return `thread-${email.thread_id}`;
  }

  // Fallback to normalized subject
  const normalizedSubject = normalizeSubject(email.subject);
  if (normalizedSubject) {
    return `subject-${normalizedSubject}`;
  }

  // Last resort: unique per email
  return `email-${email.id}`;
}

/**
 * Group emails by conversation thread.
 * Uses email headers (thread_id, email_thread_id) first, falls back to subject matching.
 */
export function groupEmailsByThread(
  emails: Communication[]
): Map<string, Communication[]> {
  const threads = new Map<string, Communication[]>();

  emails.forEach((email) => {
    // Only process emails (not texts)
    const type = email.communication_type || email.channel;
    if (type && type !== "email") return;

    const threadKey = getEmailThreadKey(email);
    const thread = threads.get(threadKey) || [];
    thread.push(email);
    threads.set(threadKey, thread);
  });

  // Sort emails within each thread chronologically (oldest first)
  threads.forEach((msgs, key) => {
    threads.set(
      key,
      msgs.sort((a, b) => {
        const dateA = new Date(a.sent_at || a.received_at || 0).getTime();
        const dateB = new Date(b.sent_at || b.received_at || 0).getTime();
        return dateA - dateB;
      })
    );
  });

  return threads;
}

/**
 * Convert grouped emails to EmailThread objects for display.
 */
export function createEmailThreads(
  groupedEmails: Map<string, Communication[]>
): EmailThread[] {
  const threads: EmailThread[] = [];

  groupedEmails.forEach((emails, threadKey) => {
    if (emails.length === 0) return;

    const firstEmail = emails[0];
    const lastEmail = emails[emails.length - 1];

    // Collect all unique participants across all emails in thread
    const allParticipants = new Set<string>();
    emails.forEach(email => {
      getEmailParticipants(email).forEach(p => allParticipants.add(p));
    });

    // Deduplicate participants by email address
    const uniqueEmails = new Map<string, string>();
    allParticipants.forEach(p => {
      const email = extractEmail(p);
      // Keep the version with the display name if available
      if (!uniqueEmails.has(email) || p.includes("<")) {
        uniqueEmails.set(email, p);
      }
    });

    threads.push({
      id: threadKey,
      subject: firstEmail.subject || "(No Subject)",
      participants: Array.from(uniqueEmails.values()),
      emailCount: emails.length,
      startDate: new Date(firstEmail.sent_at || firstEmail.received_at || 0),
      endDate: new Date(lastEmail.sent_at || lastEmail.received_at || 0),
      emails: emails,
    });
  });

  return threads;
}

/**
 * Sort email threads by most recent email (newest first).
 */
export function sortEmailThreadsByRecent(threads: EmailThread[]): EmailThread[] {
  return threads.sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
}

/**
 * Process communications into sorted email threads ready for display.
 * This is the main entry point for email thread grouping.
 */
export function processEmailThreads(communications: Communication[]): EmailThread[] {
  // Filter to only emails
  const emails = communications.filter(c => {
    const type = c.communication_type || c.channel;
    return !type || type === "email";
  });

  // Group into threads
  const grouped = groupEmailsByThread(emails);

  // Create thread objects
  const threads = createEmailThreads(grouped);

  // Sort by most recent
  return sortEmailThreadsByRecent(threads);
}
