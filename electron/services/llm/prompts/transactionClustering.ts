/**
 * Transaction Clustering Prompt Template
 * TASK-318: Extracted from clusterTransactionsTool.ts (TASK-317)
 *
 * Groups analyzed messages into transaction clusters.
 */

import { PromptTemplate, PromptMetadata, computePromptHash } from './types';
import { ClusterTransactionsInput } from '../tools/types';

/**
 * System prompt for transaction clustering.
 * Instructs the LLM to group emails by property/transaction.
 */
const SYSTEM_PROMPT = `You are a real estate transaction analyst. Group the provided email analyses into distinct transaction clusters.

IMPORTANT: Return ONLY valid JSON matching this exact schema:
{
  "clusters": [
    {
      "propertyAddress": string,
      "messageIds": [string],
      "transactionType": "purchase" | "sale" | "lease" | null,
      "stage": "prospecting" | "active" | "pending" | "closing" | "closed" | null,
      "confidence": number (0-1),
      "summary": string (1-2 sentence description)
    }
  ],
  "unclustered": [string] (message IDs that don't clearly belong to any transaction)
}

Clustering rules:
1. Primary grouping key is property address
2. Messages about the same property belong together
3. If address is unclear, use participant overlap as secondary signal
4. Separate overlapping timeframes with different properties
5. Mark ambiguous assignments with lower confidence`;

/**
 * User prompt template - dynamically constructed based on input.
 * Template marker used for hash computation.
 */
const USER_PROMPT_TEMPLATE_MARKER = 'TRANSACTION_CLUSTERING_USER_PROMPT';

/**
 * Transaction clustering prompt template.
 * Used by ClusterTransactionsTool to construct LLM messages.
 */
export const transactionClusteringPrompt: PromptTemplate<ClusterTransactionsInput> = {
  name: 'transaction-clustering',
  version: '1.0.0',
  hash: computePromptHash(SYSTEM_PROMPT, USER_PROMPT_TEMPLATE_MARKER),

  buildSystemPrompt: () => SYSTEM_PROMPT,

  buildUserPrompt: (input: ClusterTransactionsInput) => {
    let prompt = `Group these analyzed emails into transaction clusters:\n\n`;

    if (input.existingTransactions && input.existingTransactions.length > 0) {
      prompt += `Existing transactions (for reference):\n`;
      input.existingTransactions.forEach((t) => {
        prompt += `- ${t.propertyAddress} (${t.transactionType || 'unknown type'})\n`;
      });
      prompt += '\n';
    }

    prompt += `Analyzed messages:\n\n`;
    input.analyzedMessages.forEach((msg, i) => {
      prompt += `Message ${i + 1} (ID: ${msg.id}):\n`;
      prompt += `- Subject: ${msg.subject}\n`;
      prompt += `- From: ${msg.sender}\n`;
      prompt += `- Date: ${msg.date}\n`;
      prompt += `- Is RE: ${msg.analysis.isRealEstateRelated}, Confidence: ${msg.analysis.confidence}\n`;
      if (msg.analysis.extractedEntities.addresses.length > 0) {
        prompt += `- Addresses: ${msg.analysis.extractedEntities.addresses.map((a) => a.value).join(', ')}\n`;
      }
      if (msg.analysis.transactionIndicators.type) {
        prompt += `- Type: ${msg.analysis.transactionIndicators.type}, Stage: ${msg.analysis.transactionIndicators.stage || 'unknown'}\n`;
      }
      prompt += '\n';
    });

    return prompt;
  },
};

/**
 * Metadata for the transaction clustering prompt.
 * Used for cataloging and auditing prompt versions.
 */
export const transactionClusteringMetadata: PromptMetadata = {
  name: transactionClusteringPrompt.name,
  version: transactionClusteringPrompt.version,
  hash: transactionClusteringPrompt.hash,
  createdAt: '2024-12-18',
  description: 'Groups analyzed messages into transaction clusters',
};
