/**
 * Batch Analysis Prompt Template
 * TASK-509: Prompt for batch email analysis
 *
 * Analyzes multiple emails in a single LLM call for cost efficiency.
 */

import { PromptTemplate, computePromptHash } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Input for batch analysis prompt
 */
export interface BatchAnalysisInput {
  emailCount: number;
}

// ============================================================================
// Prompt Content
// ============================================================================

/**
 * System prompt for batch email analysis.
 * Instructs the LLM to analyze multiple emails and return structured JSON.
 */
const SYSTEM_PROMPT = `You are a real estate transaction analyst. Analyze each email for real estate relevance.

IMPORTANT: Return ONLY a valid JSON array with exactly one object per email, in the same order as input.

Each object MUST have this exact structure:
{
  "isRealEstateRelated": boolean,
  "confidence": number (0-1),
  "transactionType": "purchase" | "sale" | "lease" | null,
  "propertyAddress": string | null,
  "reasoning": string (brief explanation)
}

Real estate indicators include:
- Property addresses (street, city, state, zip)
- MLS numbers
- Closing/escrow terminology
- Buyer/seller mentions
- Offer amounts and price discussions
- Inspection and appraisal dates
- Title/deed references
- Real estate agent signatures

If an email is NOT related to real estate, set isRealEstateRelated to false with low confidence.

Return ONLY the JSON array, no markdown code blocks or additional text.`;

/**
 * User prompt template for batch analysis.
 */
const USER_PROMPT_TEMPLATE = `Analyze the following {{emailCount}} emails for real estate transactions.
Return a JSON array with one result object per email, in the same order.`;

// ============================================================================
// Prompt Template
// ============================================================================

/**
 * Batch analysis prompt template.
 * Used by the optimized pipeline to analyze multiple emails at once.
 */
export const batchAnalysisPrompt: PromptTemplate<BatchAnalysisInput> = {
  name: 'batch-analysis',
  version: '1.0.0',
  hash: computePromptHash(SYSTEM_PROMPT, USER_PROMPT_TEMPLATE),

  buildSystemPrompt: () => SYSTEM_PROMPT,

  buildUserPrompt: (input: BatchAnalysisInput) => {
    return USER_PROMPT_TEMPLATE.replace('{{emailCount}}', input.emailCount.toString());
  },
};

/**
 * Export the raw system prompt for use in formatBatchPrompt
 */
export const BATCH_ANALYSIS_SYSTEM_PROMPT = SYSTEM_PROMPT;
