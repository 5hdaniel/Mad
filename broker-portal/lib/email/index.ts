/**
 * Email service module for the broker portal.
 *
 * Wraps Microsoft Graph API (client credentials flow) to send
 * transactional emails. Provides typed send functions and branded
 * HTML email templates.
 *
 * Usage:
 *   import { sendInviteEmail } from '@/lib/email';
 *   const result = await sendInviteEmail({ ... });
 *   if (!result.success) console.error(result.error);
 *
 * TASK-2197: Email Service Infrastructure
 */

// Core send function
export { sendEmail } from './send-email';

// Template builders
export { buildInviteEmail } from './templates/invite';
export { buildTicketReplyNotification } from './templates/ticket-reply-notification';
export { buildTicketAssignmentNotification } from './templates/ticket-assignment-notification';

// Types
export type {
  SendEmailParams,
  SendEmailResult,
  EmailContent,
  InviteEmailParams,
  TicketReplyNotificationParams,
  TicketAssignmentNotificationParams,
} from './types';

// ---------------------------------------------------------------------------
// Convenience wrappers that compose template + send
// ---------------------------------------------------------------------------

import { sendEmail } from './send-email';
import { buildInviteEmail } from './templates/invite';
import { buildTicketReplyNotification } from './templates/ticket-reply-notification';
import { buildTicketAssignmentNotification } from './templates/ticket-assignment-notification';
import type {
  InviteEmailParams,
  TicketReplyNotificationParams,
  TicketAssignmentNotificationParams,
  SendEmailResult,
} from './types';

/**
 * Send an invite email to a new user.
 *
 * Composes the invite template and sends it via Graph API.
 */
export async function sendInviteEmail(
  params: InviteEmailParams,
): Promise<SendEmailResult> {
  const { subject, html, text } = buildInviteEmail(params);
  return sendEmail({ to: params.recipientEmail, subject, html, text });
}

/**
 * Send a ticket reply notification to the customer.
 *
 * Composes the reply notification template and sends it via Graph API.
 */
export async function sendTicketReplyNotification(
  params: TicketReplyNotificationParams,
): Promise<SendEmailResult> {
  const { subject, html, text } = buildTicketReplyNotification(params);
  return sendEmail({ to: params.recipientEmail, subject, html, text });
}

/**
 * Send a ticket assignment notification to an agent.
 *
 * Composes the assignment notification template and sends it via Graph API.
 */
export async function sendTicketAssignmentNotification(
  params: TicketAssignmentNotificationParams,
): Promise<SendEmailResult> {
  const { subject, html, text } = buildTicketAssignmentNotification(params);
  return sendEmail({ to: params.recipientEmail, subject, html, text });
}
