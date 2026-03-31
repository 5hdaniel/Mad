/**
 * Generic email send function using Microsoft Graph API.
 *
 * Duplicated from broker-portal/lib/email/send-email.ts because the
 * admin-portal is a separate Next.js app and cannot import from broker-portal.
 *
 * Uses POST /users/{senderAddress}/sendMail to send emails via the
 * organisation's M365 mailbox. Never throws -- always returns a
 * structured result object.
 *
 * BACKLOG-1492: Admin invite users
 */

import { getGraphClient } from './graph-client';
import type { SendEmailParams, SendEmailResult } from './types';

/**
 * Send an email via Microsoft Graph API.
 *
 * @returns A result object indicating success or failure. Never throws.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const client = getGraphClient();
    if (!client) {
      return {
        success: false,
        error: 'Email service not configured (missing Azure credentials)',
      };
    }

    const senderAddress = params.from || process.env.EMAIL_SENDER_ADDRESS;
    if (!senderAddress) {
      return {
        success: false,
        error: 'Email service not configured (missing EMAIL_SENDER_ADDRESS)',
      };
    }

    const toRecipients = (
      Array.isArray(params.to) ? params.to : [params.to]
    ).map((address) => ({
      emailAddress: { address },
    }));

    const message: Record<string, unknown> = {
      subject: params.subject,
      body: {
        contentType: 'HTML',
        content: params.html,
      },
      toRecipients,
    };

    if (params.replyTo) {
      message.replyTo = [{ emailAddress: { address: params.replyTo } }];
    }

    await client.api(`/users/${senderAddress}/sendMail`).post({ message });

    return { success: true };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown email error';
    console.error('[Email] Graph API error sending email:', errorMessage);
    return { success: false, error: errorMessage };
  }
}
