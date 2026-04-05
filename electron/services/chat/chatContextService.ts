/**
 * Chat Context Service
 * Builds context for the AI chatbot by querying local SQLite data.
 * Provides relevant transaction, contact, and email data to the LLM.
 */

import { dbGet, dbAll } from '../db/core/dbConnection';
import logService from '../logService';

interface TransactionSummary {
  id: string;
  property_address: string;
  status: string;
  started_at: string | null;
  closed_at: string | null;
  message_count: number;
  participant_count: number;
}

interface ContactSummary {
  id: string;
  display_name: string;
  default_role: string | null;
  total_messages: number;
}

/**
 * Build context string from user's data for the chatbot system prompt.
 */
export class ChatContextService {
  /**
   * Get a summary of the user's transactions for context.
   */
  getTransactionContext(userId: string, limit = 10): string {
    try {
      const transactions = dbAll<TransactionSummary>(
        `SELECT id, property_address, status, started_at, closed_at, message_count,
         (SELECT COUNT(*) FROM transaction_contacts tc WHERE tc.transaction_id = t.id) as participant_count
         FROM transactions t
         WHERE t.user_id = ?
         ORDER BY t.updated_at DESC
         LIMIT ?`,
        [userId, limit]
      );

      if (!transactions || transactions.length === 0) {
        return 'No transactions found.';
      }

      const lines = transactions.map((t) =>
        `- ${t.property_address || 'Unknown address'} (${t.status}) — ${t.message_count} messages, ${t.participant_count} contacts${t.started_at ? `, started ${t.started_at}` : ''}${t.closed_at ? `, closed ${t.closed_at}` : ''}`
      );

      return `User's recent transactions (${transactions.length}):\n${lines.join('\n')}`;
    } catch (error) {
      logService.error('Failed to get transaction context', 'ChatContext', { error });
      return 'Unable to load transaction data.';
    }
  }

  /**
   * Get a summary of the user's contacts for context.
   */
  getContactContext(userId: string, limit = 20): string {
    try {
      const contacts = dbAll<ContactSummary>(
        `SELECT id, display_name, default_role, total_messages
         FROM contacts
         WHERE user_id = ?
         ORDER BY total_messages DESC
         LIMIT ?`,
        [userId, limit]
      );

      if (!contacts || contacts.length === 0) {
        return 'No contacts found.';
      }

      const lines = contacts.map((c) =>
        `- ${c.display_name}${c.default_role ? ` (${c.default_role})` : ''} — ${c.total_messages} messages`
      );

      return `User's top contacts (${contacts.length}):\n${lines.join('\n')}`;
    } catch (error) {
      logService.error('Failed to get contact context', 'ChatContext', { error });
      return 'Unable to load contact data.';
    }
  }

  /**
   * Get recent email summaries for context.
   */
  getEmailContext(userId: string, limit = 10): string {
    try {
      const emails = dbAll<{ subject: string; sent_at: string; participants_flat: string }>(
        `SELECT subject, sent_at, participants_flat
         FROM communications
         WHERE user_id = ? AND channel = 'email'
         ORDER BY sent_at DESC
         LIMIT ?`,
        [userId, limit]
      );

      if (!emails || emails.length === 0) {
        return 'No recent emails.';
      }

      const lines = emails.map((e) =>
        `- "${e.subject || '(no subject)'}" — ${e.sent_at ?? 'unknown date'}`
      );

      return `Recent emails (${emails.length}):\n${lines.join('\n')}`;
    } catch (error) {
      logService.error('Failed to get email context', 'ChatContext', { error });
      return 'Unable to load email data.';
    }
  }

  /**
   * Build full system prompt with user data context.
   */
  buildSystemPrompt(userId: string): string {
    const txnContext = this.getTransactionContext(userId);
    const contactContext = this.getContactContext(userId);
    const emailContext = this.getEmailContext(userId);

    return `You are Keepr AI, a helpful assistant for real estate transaction management.
You have access to the user's transaction data, contacts, and communications.
Answer questions based on the data provided below. Be concise and helpful.
If you don't have enough information to answer, say so.

${txnContext}

${contactContext}

${emailContext}`;
  }
}

export const chatContextService = new ChatContextService();
export default chatContextService;
