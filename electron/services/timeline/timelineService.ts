/**
 * Timeline Service
 * Generates AI-powered transaction timelines from email data.
 * Caches results in the transaction_timelines table.
 */

import crypto from 'crypto';
import { dbGet, dbAll, dbRun } from '../db/core/dbConnection';
import { generateTimeline } from '../llm/tools/generateTimelineTool';
import type { TimelineEvent } from '../llm/tools/types';
import type { BaseLLMService } from '../llm/baseLLMService';
import type { LLMConfig } from '../llm/types';
import logService from '../logService';

interface CachedTimeline {
  events: TimelineEvent[];
  generatedAt: string;
  modelUsed: string;
}

interface EmailRow {
  id: string;
  subject: string;
  participants: string | null;
  participants_flat: string | null;
  sent_at: string | null;
  body_text: string | null;
}

interface AttachmentRow {
  id: string;
  filename: string;
  communication_id: string;
}

export class TimelineService {
  /**
   * Get cached timeline for a transaction, or null if not generated yet.
   */
  getCachedTimeline(transactionId: string): CachedTimeline | null {
    const row = dbGet<{ events_json: string; generated_at: string; model_used: string }>(
      'SELECT events_json, generated_at, model_used FROM transaction_timelines WHERE transaction_id = ? ORDER BY generated_at DESC LIMIT 1',
      [transactionId]
    );

    if (!row) return null;

    try {
      return {
        events: JSON.parse(row.events_json),
        generatedAt: row.generated_at,
        modelUsed: row.model_used,
      };
    } catch {
      logService.error('Failed to parse cached timeline', 'TimelineService', { transactionId });
      return null;
    }
  }

  /**
   * Generate a timeline for a transaction using the LLM.
   */
  async generateTimeline(
    transactionId: string,
    service: BaseLLMService,
    config: LLMConfig
  ): Promise<CachedTimeline> {
    // 1. Load emails for this transaction
    const emails = dbAll<EmailRow>(
      `SELECT id, subject, participants, participants_flat, sent_at, body_text
       FROM communications
       WHERE transaction_id = ? AND channel = 'email'
       ORDER BY sent_at ASC`,
      [transactionId]
    ) ?? [];

    if (emails.length === 0) {
      return { events: [], generatedAt: new Date().toISOString(), modelUsed: config.model };
    }

    // 2. Load attachments for these emails
    const emailIds = emails.map(e => e.id);
    const placeholders = emailIds.map(() => '?').join(',');
    const attachments = dbAll<AttachmentRow>(
      `SELECT id, filename, communication_id
       FROM email_attachments
       WHERE communication_id IN (${placeholders})`,
      emailIds
    ) ?? [];

    // Group attachments by email
    const attachmentMap = new Map<string, Array<{ id: string; filename: string }>>();
    for (const att of attachments) {
      const list = attachmentMap.get(att.communication_id) ?? [];
      list.push({ id: att.id, filename: att.filename });
      attachmentMap.set(att.communication_id, list);
    }

    // 3. Build email summaries
    const emailSummaries = emails.map(e => {
      let from = '';
      let to = '';
      try {
        if (e.participants) {
          const parsed = JSON.parse(e.participants);
          from = parsed.from || '';
          to = Array.isArray(parsed.to) ? parsed.to.join(', ') : (parsed.to || '');
        }
      } catch {
        from = e.participants_flat || '';
      }

      return {
        id: e.id,
        subject: e.subject || '(no subject)',
        from,
        to,
        date: e.sent_at || '',
        bodyPreview: (e.body_text || '').substring(0, 500),
        attachments: attachmentMap.get(e.id) ?? [],
      };
    });

    // 4. Call the LLM tool
    const result = await generateTimeline(emailSummaries, service, config);

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Timeline generation failed');
    }

    // 5. Cache the result
    const id = crypto.randomUUID();
    const eventsJson = JSON.stringify(result.data.events);
    dbRun(
      `INSERT INTO transaction_timelines (id, transaction_id, model_used, events_json)
       VALUES (?, ?, ?, ?)`,
      [id, transactionId, config.model, eventsJson]
    );

    const cached: CachedTimeline = {
      events: result.data.events,
      generatedAt: new Date().toISOString(),
      modelUsed: config.model,
    };

    logService.info(
      `Timeline generated: ${result.data.events.length} events for transaction ${transactionId}`,
      'TimelineService'
    );

    return cached;
  }

  /**
   * Delete cached timeline and regenerate.
   */
  async regenerateTimeline(
    transactionId: string,
    service: BaseLLMService,
    config: LLMConfig
  ): Promise<CachedTimeline> {
    // Delete old cached timelines
    dbRun('DELETE FROM transaction_timelines WHERE transaction_id = ?', [transactionId]);

    // Generate fresh
    return this.generateTimeline(transactionId, service, config);
  }
}

export const timelineService = new TimelineService();
export default timelineService;
