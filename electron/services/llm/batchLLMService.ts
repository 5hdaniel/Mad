/**
 * Batch LLM Service
 * TASK-507: Batch multiple emails into single LLM requests
 *
 * This service optimizes LLM usage by:
 * 1. Grouping emails into batches within token limits
 * 2. Estimating token counts to maximize batch efficiency
 * 3. Formatting batched prompts for LLM analysis
 */

import { v4 as uuidv4 } from 'uuid';
import type { MessageInput } from '../extraction/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for batch creation
 */
export interface BatchConfig {
  /** Maximum tokens per batch (default: 50000) */
  maxTokensPerBatch: number;
  /** Maximum emails per batch (default: 30) */
  maxEmailsPerBatch: number;
  /** Average tokens per email for estimation (default: 1000) */
  avgTokensPerEmail: number;
}

/**
 * A batch of emails ready for LLM processing
 */
export interface EmailBatch {
  batchId: string;
  emails: MessageInput[];
  estimatedTokens: number;
}

/**
 * Result of batching operation
 */
export interface BatchingResult {
  batches: EmailBatch[];
  stats: {
    totalEmails: number;
    totalBatches: number;
    avgEmailsPerBatch: number;
    estimatedTotalTokens: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default batch configuration.
 * Conservative limits to stay well under model context limits.
 */
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxTokensPerBatch: 50000, // Well under Claude's 200K context
  maxEmailsPerBatch: 30, // Reasonable for structured output
  avgTokensPerEmail: 1000, // Conservative estimate
};

/**
 * Character-to-token ratio for estimation.
 * Using 3:1 for safety margin (4:1 is typical but can underestimate).
 */
const CHARS_PER_TOKEN = 3;

/**
 * Maximum body preview length for token estimation and prompts.
 */
const MAX_BODY_PREVIEW = 2000;

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate tokens for an email based on subject and body preview.
 *
 * @param email - Email to estimate tokens for
 * @returns Estimated token count
 */
export function estimateEmailTokens(email: MessageInput): number {
  const subject = email.subject || '';
  const body = email.body || '';
  const preview = body.substring(0, MAX_BODY_PREVIEW);

  // Additional metadata (sender, recipients, date)
  const metadata = `${email.sender}${email.recipients.join(',')}${email.date}`;

  // Use 3:1 ratio for safety margin
  return Math.ceil((subject.length + preview.length + metadata.length) / CHARS_PER_TOKEN);
}

// ============================================================================
// Batch Creation
// ============================================================================

/**
 * Group emails into batches optimized for LLM context limits.
 *
 * @param emails - Emails to batch
 * @param config - Batch configuration
 * @returns Batching result with batches and stats
 */
export function createBatches(
  emails: MessageInput[],
  config: BatchConfig = DEFAULT_BATCH_CONFIG
): BatchingResult {
  if (emails.length === 0) {
    return {
      batches: [],
      stats: {
        totalEmails: 0,
        totalBatches: 0,
        avgEmailsPerBatch: 0,
        estimatedTotalTokens: 0,
      },
    };
  }

  const batches: EmailBatch[] = [];
  let currentBatch: MessageInput[] = [];
  let currentTokens = 0;

  for (const email of emails) {
    const emailTokens = estimateEmailTokens(email);

    // Check if adding this email would exceed limits
    const wouldExceedTokens = currentTokens + emailTokens > config.maxTokensPerBatch;
    const wouldExceedCount = currentBatch.length >= config.maxEmailsPerBatch;

    if (wouldExceedTokens || wouldExceedCount) {
      // Save current batch and start new one
      if (currentBatch.length > 0) {
        batches.push({
          batchId: uuidv4(),
          emails: [...currentBatch],
          estimatedTokens: currentTokens,
        });
      }
      currentBatch = [];
      currentTokens = 0;
    }

    currentBatch.push(email);
    currentTokens += emailTokens;
  }

  // Don't forget the last batch
  if (currentBatch.length > 0) {
    batches.push({
      batchId: uuidv4(),
      emails: currentBatch,
      estimatedTokens: currentTokens,
    });
  }

  const totalEmails = emails.length;
  const totalBatches = batches.length;

  return {
    batches,
    stats: {
      totalEmails,
      totalBatches,
      avgEmailsPerBatch: totalBatches > 0 ? Math.round(totalEmails / totalBatches) : 0,
      estimatedTotalTokens: batches.reduce((sum, b) => sum + b.estimatedTokens, 0),
    },
  };
}

// ============================================================================
// Prompt Formatting
// ============================================================================

/**
 * Format a batch of emails into an LLM prompt.
 *
 * @param batch - Batch of emails to format
 * @returns Formatted prompt string
 */
export function formatBatchPrompt(batch: EmailBatch): string {
  const lines: string[] = [];

  lines.push(`Analyze the following ${batch.emails.length} emails for real estate transactions.`);
  lines.push(`Return results as a JSON array with one object per email, matching the input order.`);
  lines.push(``);
  lines.push(`Each object should have:`);
  lines.push(`- "id": the email ID`);
  lines.push(`- "isRealEstateRelated": boolean`);
  lines.push(`- "confidence": 0-1 score`);
  lines.push(`- "transactionType": "purchase" | "sale" | "lease" | null`);
  lines.push(`- "propertyAddress": extracted address or null`);
  lines.push(`- "reasoning": brief explanation`);
  lines.push(``);

  batch.emails.forEach((email, index) => {
    lines.push(`--- EMAIL ${index + 1} (ID: ${email.id}) ---`);
    lines.push(`Subject: ${email.subject || '(no subject)'}`);
    lines.push(`From: ${email.sender || 'unknown'}`);
    lines.push(`To: ${email.recipients.join(', ') || 'unknown'}`);
    lines.push(`Date: ${email.date || 'unknown'}`);
    lines.push(`Body:`);
    lines.push((email.body || '').substring(0, MAX_BODY_PREVIEW));
    lines.push(``);
  });

  lines.push(`Respond with only the JSON array, no additional text.`);

  return lines.join('\n');
}
