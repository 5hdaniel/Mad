/**
 * Generate Timeline Tool
 * Analyzes transaction emails and attachments to produce a structured timeline
 * of key real estate milestones.
 */

import type { ToolResult, GenerateTimelineOutput, TimelineEvent } from './types';
import type { LLMMessage } from '../types';
import type { BaseLLMService } from '../baseLLMService';
import type { LLMConfig } from '../types';
import logService from '../../logService';

/**
 * Input: summarized email data for timeline generation.
 */
interface EmailSummary {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  bodyPreview: string;
  attachments: Array<{ id: string; filename: string }>;
}

const SYSTEM_PROMPT = `You are a real estate transaction analyst. Analyze the provided email communications and identify key milestones in the real estate transaction timeline.

For each milestone, provide:
- date: The date of the event (ISO format, e.g., "2026-03-15")
- title: A short title (e.g., "Buyer Representation Agreement Signed")
- description: Optional brief description
- category: One of: agreement, offer, inspection, appraisal, financing, title, escrow, closing, communication, other
- confidence: A number from 0 to 1 indicating how confident you are
- sources: Array of source references with type ("email" or "attachment"), id, and label

Common real estate milestones to look for:
- Buyer/Seller representation agreements
- Offers and counteroffers
- Inspection scheduling and reports
- Appraisal completion
- Loan/financing approval
- Title search and insurance
- Escrow opening/closing
- Closing date confirmation and final walkthrough

Return ONLY a valid JSON array of timeline events, sorted by date ascending.`;

/**
 * Generate a transaction timeline from email data.
 */
export async function generateTimeline(
  emails: EmailSummary[],
  service: BaseLLMService,
  config: LLMConfig
): Promise<ToolResult<GenerateTimelineOutput>> {
  const startTime = Date.now();

  try {
    // Build user message with email summaries
    const emailList = emails.map((e, i) => {
      const attachmentList = e.attachments.length > 0
        ? `\n  Attachments: ${e.attachments.map(a => `${a.filename} (id:${a.id})`).join(', ')}`
        : '';
      return `Email ${i + 1} (id:${e.id}):
  Subject: ${e.subject}
  From: ${e.from}
  To: ${e.to}
  Date: ${e.date}
  Preview: ${e.bodyPreview.substring(0, 300)}${attachmentList}`;
    }).join('\n\n');

    const userMessage = `Analyze these ${emails.length} emails from a real estate transaction and generate a timeline of key milestones:\n\n${emailList}`;

    const messages: LLMMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ];

    const response = await service.completeWithRetry(messages, {
      ...config,
      maxTokens: 2000,
      temperature: 0.3, // Lower temperature for more structured output
    });

    // Parse the JSON response
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return {
        success: false,
        error: 'Failed to parse timeline response as JSON',
        latencyMs: Date.now() - startTime,
      };
    }

    const events: TimelineEvent[] = JSON.parse(jsonMatch[0]);

    // Sort by date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Assign IDs if missing
    events.forEach((e, i) => {
      if (!e.id) e.id = `timeline-${i}`;
    });

    return {
      success: true,
      data: { events },
      tokensUsed: response.tokensUsed,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    logService.error('Timeline generation failed', 'TimelineTool', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime,
    };
  }
}
