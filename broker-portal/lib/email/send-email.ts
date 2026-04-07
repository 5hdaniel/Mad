/**
 * Generic email send function using Microsoft Graph API.
 *
 * Uses POST /users/{senderAddress}/sendMail to send emails via the
 * organisation's M365 mailbox. Never throws -- always returns a
 * structured result object.
 *
 * TASK-2197: Email Service Infrastructure
 * BACKLOG-1567: Email Delivery Observability (logging + Sentry)
 */

import * as Sentry from '@sentry/nextjs';
import { getGraphClient } from './graph-client';
import { createServiceClient } from '@/lib/supabase/service';
import type { SendEmailParams, SendEmailResult, EmailType } from './types';

// ---------------------------------------------------------------------------
// Delivery logging (fire-and-forget)
// ---------------------------------------------------------------------------

/**
 * Log an email delivery attempt to the email_delivery_log table.
 * Uses the service role client to bypass RLS.
 * Never throws -- failures are logged to console + Sentry.
 */
async function logEmailDelivery(opts: {
  emailType: EmailType;
  recipientEmail: string;
  status: 'sent' | 'failed' | 'skipped';
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('email_delivery_log').insert({
      email_type: opts.emailType,
      recipient_email: opts.recipientEmail,
      status: opts.status,
      error_message: opts.errorMessage || null,
      metadata: opts.metadata || {},
    });
  } catch (logError) {
    console.error('[Email] Failed to log email delivery:', logError);
    // Never block email delivery due to logging failure
  }
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

/**
 * Send an email via Microsoft Graph API.
 *
 * @returns A result object indicating success or failure. Never throws.
 *
 * On success the Graph API returns 202 Accepted with no body, so
 * `messageId` is not available.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const emailType: EmailType = params.emailType || 'other';
  const recipientEmail = Array.isArray(params.to) ? params.to[0] : params.to;
  const logMeta = {
    subject: params.subject,
    ...(params.logMetadata || {}),
  };

  // Sentry breadcrumb for every attempt
  Sentry.addBreadcrumb({
    category: 'email',
    message: `Sending ${emailType} email to ${recipientEmail}`,
    level: 'info',
    data: { emailType, subject: params.subject },
  });

  try {
    const client = getGraphClient();
    if (!client) {
      const error = 'Email service not configured (missing Azure credentials)';
      void logEmailDelivery({
        emailType,
        recipientEmail,
        status: 'skipped',
        errorMessage: error,
        metadata: logMeta,
      });
      return { success: false, error };
    }

    const senderAddress = params.from || process.env.EMAIL_SENDER_ADDRESS;
    if (!senderAddress) {
      const error = 'Email service not configured (missing EMAIL_SENDER_ADDRESS)';
      void logEmailDelivery({
        emailType,
        recipientEmail,
        status: 'skipped',
        errorMessage: error,
        metadata: logMeta,
      });
      return { success: false, error };
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

    // Log successful delivery
    void logEmailDelivery({
      emailType,
      recipientEmail,
      status: 'sent',
      metadata: logMeta,
    });

    return { success: true };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown email error';
    console.error('[Email] Graph API error sending email:', errorMessage);

    // Capture failure in Sentry
    Sentry.captureException(err, {
      tags: { email_type: emailType },
      extra: { recipientEmail, subject: params.subject },
    });

    // Log failed delivery
    void logEmailDelivery({
      emailType,
      recipientEmail,
      status: 'failed',
      errorMessage,
      metadata: logMeta,
    });

    return { success: false, error: errorMessage };
  }
}
