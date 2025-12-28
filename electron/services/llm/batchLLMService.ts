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
import logService from '../logService';

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
// Response Parser Types (TASK-508)
// ============================================================================

/**
 * Analysis result for a single email from batch processing
 */
export interface BatchAnalysisResult {
  emailId: string;
  isRealEstateRelated: boolean;
  confidence: number;
  transactionType?: 'purchase' | 'sale' | 'lease' | null;
  propertyAddress?: string;
  reasoning?: string;
  rawResponse?: unknown;
}

/**
 * Result of parsing a batch LLM response
 */
export interface BatchParseResult {
  results: BatchAnalysisResult[];
  errors: Array<{ emailId: string; error: string }>;
  stats: {
    total: number;
    successful: number;
    failed: number;
    realEstateFound: number;
  };
}

/**
 * Raw LLM response item structure (handles field name variations)
 */
interface LLMBatchResponseItem {
  id?: string;
  isRealEstateRelated?: boolean;
  is_real_estate_related?: boolean;
  confidence?: number;
  transactionType?: string;
  transaction_type?: string;
  propertyAddress?: string;
  property_address?: string;
  reasoning?: string;
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

// ============================================================================
// Response Parsing (TASK-508)
// ============================================================================

/**
 * Extract JSON array from LLM response, handling markdown code blocks.
 *
 * @param response - Raw LLM response text
 * @returns Extracted JSON array string or null
 */
export function extractJsonArray(response: string): string | null {
  if (!response || typeof response !== 'string') {
    return null;
  }

  // Step 1: Remove markdown code blocks (```json ... ``` or ``` ... ```)
  let cleaned = response
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '');

  // Step 2: Find JSON array
  const match = cleaned.match(/\[[\s\S]*\]/);
  return match ? match[0] : null;
}

/**
 * Parse batch LLM response and map results to individual emails.
 *
 * @param batch - The original email batch
 * @param llmResponse - Raw LLM response text
 * @returns Parse result with mapped results and any errors
 */
export function parseBatchResponse(
  batch: EmailBatch,
  llmResponse: string
): BatchParseResult {
  const results: BatchAnalysisResult[] = [];
  const errors: Array<{ emailId: string; error: string }> = [];

  try {
    // Extract JSON array from response
    const jsonString = extractJsonArray(llmResponse);
    if (!jsonString) {
      throw new Error('No JSON array found in response');
    }

    const parsedResults: LLMBatchResponseItem[] = JSON.parse(jsonString);

    if (!Array.isArray(parsedResults)) {
      throw new Error('Response is not an array');
    }

    // Warn on length mismatch (don't fail)
    if (parsedResults.length !== batch.emails.length) {
      logService.warn(
        `[BatchParser] Response count mismatch: expected ${batch.emails.length}, got ${parsedResults.length}`,
        "BatchLLMService"
      );
    }

    // Map results to emails by index
    for (let i = 0; i < batch.emails.length; i++) {
      const email = batch.emails[i];
      const result = parsedResults[i];

      if (!result) {
        errors.push({
          emailId: email.id,
          error: `No result at index ${i}`,
        });
        continue;
      }

      // Handle both camelCase and snake_case field names
      const isRealEstateRelated = Boolean(
        result.isRealEstateRelated ?? result.is_real_estate_related ?? false
      );
      const transactionType =
        (result.transactionType || result.transaction_type) as
          | 'purchase'
          | 'sale'
          | 'lease'
          | undefined;
      const propertyAddress = result.propertyAddress || result.property_address;

      results.push({
        emailId: email.id,
        isRealEstateRelated,
        confidence: result.confidence ?? 0,
        transactionType: transactionType || null,
        propertyAddress,
        reasoning: result.reasoning,
        rawResponse: result,
      });
    }
  } catch (error) {
    // If batch parsing fails, mark all emails as errors
    for (const email of batch.emails) {
      errors.push({
        emailId: email.id,
        error: error instanceof Error ? error.message : 'Unknown parse error',
      });
    }
  }

  return {
    results,
    errors,
    stats: {
      total: batch.emails.length,
      successful: results.length,
      failed: errors.length,
      realEstateFound: results.filter((r) => r.isRealEstateRelated).length,
    },
  };
}

/**
 * Fallback: Process failed batch emails individually.
 * Used when batch parsing fails but we want to retry emails one-by-one.
 *
 * @param errors - List of failed emails from batch parsing
 * @param emailMap - Map of email ID to email data
 * @param analyzeFn - Function to analyze a single email
 * @returns Results from individual analysis
 */
export async function processBatchErrors(
  errors: Array<{ emailId: string; error: string }>,
  emailMap: Map<string, MessageInput>,
  analyzeFn: (email: MessageInput) => Promise<BatchAnalysisResult>
): Promise<BatchAnalysisResult[]> {
  const fallbackResults: BatchAnalysisResult[] = [];

  for (const errorItem of errors) {
    const email = emailMap.get(errorItem.emailId);
    if (!email) continue;

    try {
      const result = await analyzeFn(email);
      fallbackResults.push(result);
    } catch {
      // Skip if individual analysis also fails
      logService.warn(`[BatchParser] Fallback failed for email ${errorItem.emailId}`, "BatchLLMService");
    }
  }

  return fallbackResults;
}
