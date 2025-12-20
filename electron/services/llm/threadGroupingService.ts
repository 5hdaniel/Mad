/**
 * Thread Grouping Service
 * TASK-504: Group emails by thread_id for first-email-only analysis
 *
 * This service enables massive cost reduction by:
 * 1. Grouping emails by thread (conversation)
 * 2. Identifying the first email in each thread
 * 3. Only analyzing the first email (if it's a transaction, all are)
 */

import type { Message } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface ThreadGroup {
  threadId: string;
  emails: Message[];
  firstEmail: Message;
  emailCount: number;
  hasTransaction?: boolean;
}

export interface ThreadGroupingResult {
  threads: Map<string, ThreadGroup>;
  orphanEmails: Message[]; // Emails without thread_id
  stats: {
    totalEmails: number;
    totalThreads: number;
    orphanCount: number;
    avgEmailsPerThread: number;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if email A is earlier than email B
 */
function isEarlier(a: Message, b: Message): boolean {
  const dateA = a.sent_at || a.received_at || a.created_at;
  const dateB = b.sent_at || b.received_at || b.created_at;

  if (!dateA) return false;
  if (!dateB) return true;

  return new Date(dateA) < new Date(dateB);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Group emails by thread_id and identify the first email in each thread.
 *
 * @param emails - Array of emails to group
 * @returns ThreadGroupingResult with grouped threads, orphans, and stats
 */
export function groupEmailsByThread(emails: Message[]): ThreadGroupingResult {
  const threads = new Map<string, ThreadGroup>();
  const orphanEmails: Message[] = [];

  for (const email of emails) {
    // Handle emails without thread_id as orphans
    if (!email.thread_id) {
      orphanEmails.push(email);
      continue;
    }

    if (!threads.has(email.thread_id)) {
      threads.set(email.thread_id, {
        threadId: email.thread_id,
        emails: [],
        firstEmail: email,
        emailCount: 0,
      });
    }

    const thread = threads.get(email.thread_id)!;
    thread.emails.push(email);
    thread.emailCount++;

    // Update first email if this one is older
    if (isEarlier(email, thread.firstEmail)) {
      thread.firstEmail = email;
    }
  }

  const totalThreads = threads.size;
  const totalEmails = emails.length;
  const orphanCount = orphanEmails.length;

  return {
    threads,
    orphanEmails,
    stats: {
      totalEmails,
      totalThreads,
      orphanCount,
      avgEmailsPerThread:
        totalThreads > 0 ? (totalEmails - orphanCount) / totalThreads : 0,
    },
  };
}

/**
 * Get only first emails from thread groups (for LLM analysis).
 * Includes orphan emails (they get analyzed individually).
 *
 * @param result - ThreadGroupingResult from groupEmailsByThread
 * @returns Array of first emails plus orphans
 */
export function getFirstEmailsFromThreads(
  result: ThreadGroupingResult
): Message[] {
  const firstEmails: Message[] = [];

  for (const thread of result.threads.values()) {
    firstEmails.push(thread.firstEmail);
  }

  // Include orphan emails (they get analyzed individually)
  return [...firstEmails, ...result.orphanEmails];
}
