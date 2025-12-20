/**
 * Spam Filter Service
 * Filters out spam/junk emails before LLM processing to reduce costs
 *
 * TASK-501: Gmail Spam Detection
 * TASK-502: Outlook Junk Detection (will be added)
 */

// Gmail spam labels to filter
const GMAIL_SPAM_LABELS = ['SPAM', 'TRASH'];

// Gmail promotional/social labels (optional, configurable)
const GMAIL_SKIP_LABELS = ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL'];

export interface SpamFilterResult {
  isSpam: boolean;
  reason?: string;
  labels?: string[];
}

/**
 * Check if a Gmail email should be filtered (is spam/trash)
 */
export function isGmailSpam(labels: string[]): SpamFilterResult {
  const spamLabel = labels.find((l) => GMAIL_SPAM_LABELS.includes(l));
  if (spamLabel) {
    return {
      isSpam: true,
      reason: `Gmail label: ${spamLabel}`,
      labels,
    };
  }
  return { isSpam: false, labels };
}

/**
 * Check if Gmail email is promotional/social (optional filter)
 * Use this as an OPT-IN filter for users who want to skip promotional emails
 */
export function isGmailPromotional(labels: string[]): SpamFilterResult {
  const skipLabel = labels.find((l) => GMAIL_SKIP_LABELS.includes(l));
  if (skipLabel) {
    return {
      isSpam: true,
      reason: `Gmail category: ${skipLabel}`,
      labels,
    };
  }
  return { isSpam: false, labels };
}
