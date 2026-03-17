/**
 * Ticket confirmation email template.
 *
 * Sent to the requester when they submit a new support ticket,
 * confirming receipt and providing a link to track status.
 */

import { baseLayout } from './base-layout';
import type { EmailContent, TicketConfirmationParams } from '../types';

export function buildTicketConfirmationEmail(params: TicketConfirmationParams): EmailContent {
  const { ticketSubject, ticketNumber, ticketLink } = params;

  const subject = `We received your request — ${ticketNumber}`;

  const html = baseLayout({
    preheader: `Your support request ${ticketNumber} has been received`,
    body: `
      <h1 style="margin:0 0 16px 0; font-size:24px; font-weight:700; color:#111827; line-height:1.3;">
        We've received your request
      </h1>
      <p style="margin:0 0 8px 0; font-size:16px; color:#374151; line-height:1.6;">
        Your support ticket has been created and our team will review it shortly.
      </p>
      <table cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 24px 0; width:100%;">
        <tr>
          <td style="padding:16px; background-color:#f9fafb; border-radius:6px; border:1px solid #e5e7eb;">
            <p style="margin:0 0 4px 0; font-size:13px; color:#6b7280;">Ticket</p>
            <p style="margin:0 0 12px 0; font-size:15px; font-weight:600; color:#111827;">${escapeHtml(ticketNumber)}</p>
            <p style="margin:0 0 4px 0; font-size:13px; color:#6b7280;">Subject</p>
            <p style="margin:0; font-size:15px; color:#111827;">${escapeHtml(ticketSubject)}</p>
          </td>
        </tr>
      </table>
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
        <tr>
          <td align="center" style="border-radius:6px; background-color:#4f46e5;">
            <a href="${escapeAttr(ticketLink)}"
               target="_blank"
               style="display:inline-block; padding:14px 32px; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:6px; background-color:#4f46e5;">
              View Ticket
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0; font-size:14px; color:#6b7280; line-height:1.5;">
        You'll receive an email notification when our team responds.
      </p>
    `,
  });

  const text = [
    `We received your request — ${ticketNumber}`,
    '',
    'Your support ticket has been created and our team will review it shortly.',
    '',
    `Ticket: ${ticketNumber}`,
    `Subject: ${ticketSubject}`,
    '',
    `View your ticket: ${ticketLink}`,
    '',
    "You'll receive an email notification when our team responds.",
  ].join('\n');

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
