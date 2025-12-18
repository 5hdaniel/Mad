/**
 * Message Analysis Prompt Template
 * TASK-318: Extracted from analyzeMessageTool.ts (TASK-315)
 *
 * Analyzes email content for real estate relevance and extracts entities.
 */

import { PromptTemplate, PromptMetadata, computePromptHash } from './types';
import { AnalyzeMessageInput } from '../tools/types';

/**
 * System prompt for message analysis.
 * Instructs the LLM to analyze emails and return structured JSON.
 */
const SYSTEM_PROMPT = `You are a real estate transaction analyst. Analyze the provided email and extract structured information.

IMPORTANT: Return ONLY valid JSON matching this exact schema:
{
  "isRealEstateRelated": boolean,
  "confidence": number (0-1),
  "transactionIndicators": {
    "type": "purchase" | "sale" | "lease" | null,
    "stage": "prospecting" | "active" | "pending" | "closing" | "closed" | null
  },
  "extractedEntities": {
    "addresses": [{ "value": string, "confidence": number }],
    "amounts": [{ "value": number, "context": string }],
    "dates": [{ "value": string (ISO format), "type": "closing" | "inspection" | "other" }],
    "contacts": [{ "name": string, "email": string?, "phone": string?, "suggestedRole": string? }]
  },
  "reasoning": string (brief explanation of analysis)
}

Real estate indicators include: property addresses, MLS numbers, closing/escrow terms, buyer/seller mentions, offer amounts, inspection dates, title/deed references.

If the email is NOT related to real estate, set isRealEstateRelated to false with low confidence and empty arrays for entities.`;

/**
 * User prompt template with placeholders for email content.
 * Placeholders: {{sender}}, {{recipients}}, {{date}}, {{subject}}, {{body}}
 */
const USER_PROMPT_TEMPLATE = `Analyze this email:

From: {{sender}}
To: {{recipients}}
Date: {{date}}
Subject: {{subject}}

Body:
{{body}}`;

/**
 * Message analysis prompt template.
 * Used by AnalyzeMessageTool to construct LLM messages.
 */
export const messageAnalysisPrompt: PromptTemplate<AnalyzeMessageInput> = {
  name: 'message-analysis',
  version: '1.0.0',
  hash: computePromptHash(SYSTEM_PROMPT, USER_PROMPT_TEMPLATE),

  buildSystemPrompt: () => SYSTEM_PROMPT,

  buildUserPrompt: (input: AnalyzeMessageInput) => {
    return USER_PROMPT_TEMPLATE.replace('{{sender}}', input.sender)
      .replace('{{recipients}}', input.recipients.join(', '))
      .replace('{{date}}', input.date)
      .replace('{{subject}}', input.subject)
      .replace('{{body}}', input.body);
  },
};

/**
 * Metadata for the message analysis prompt.
 * Used for cataloging and auditing prompt versions.
 */
export const messageAnalysisMetadata: PromptMetadata = {
  name: messageAnalysisPrompt.name,
  version: messageAnalysisPrompt.version,
  hash: messageAnalysisPrompt.hash,
  createdAt: '2024-12-18',
  description: 'Analyzes email content for real estate relevance and extracts entities',
};
