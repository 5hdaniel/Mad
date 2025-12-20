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

// =============================================================================
// OUTLOOK JUNK DETECTION (TASK-502)
// =============================================================================

// Outlook junk folder names (well-known)
const OUTLOOK_JUNK_FOLDER_NAMES = [
  'junkemail',
  'junk email',
  'deleteditems',
  'deleted items',
];

export interface OutlookSpamCheckInput {
  inferenceClassification?: string;
  parentFolderId?: string;
  parentFolderName?: string; // If resolved
}

/**
 * Check if an Outlook email should be filtered (is in junk/deleted folder)
 * NOTE: Only checks folder-based junk, NOT inferenceClassification (too aggressive)
 */
export function isOutlookJunk(input: OutlookSpamCheckInput): SpamFilterResult {
  // ONLY check folder - inferenceClassification is too aggressive for spam detection
  // (it marks newsletters and non-focused emails which may contain transactions)
  if (input.parentFolderName) {
    const folderLower = input.parentFolderName.toLowerCase();
    if (OUTLOOK_JUNK_FOLDER_NAMES.some((junk) => folderLower.includes(junk))) {
      return {
        isSpam: true,
        reason: `Outlook folder: ${input.parentFolderName}`,
      };
    }
  }

  return { isSpam: false };
}

/**
 * OPTIONAL: Check if Outlook email is not in focused inbox
 * Use this as an OPT-IN filter, not default spam detection
 * WARNING: This will filter newsletters and less important emails which MAY contain transactions
 */
export function isOutlookNonFocused(
  input: OutlookSpamCheckInput
): SpamFilterResult {
  if (input.inferenceClassification === 'other') {
    return {
      isSpam: true,
      reason: 'Outlook inferenceClassification: other (not focused)',
    };
  }
  return { isSpam: false };
}
