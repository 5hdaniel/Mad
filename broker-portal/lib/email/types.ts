/**
 * TypeScript types for email service payloads and results.
 *
 * TASK-2197: Email Service Infrastructure
 */

// ---------------------------------------------------------------------------
// Core send types
// ---------------------------------------------------------------------------

export interface SendEmailParams {
  /** Recipient email address or array of addresses */
  to: string | string[];
  /** Email subject line */
  subject: string;
  /** HTML body content */
  html: string;
  /** Plain-text fallback body */
  text: string;
  /** Sender address (defaults to EMAIL_SENDER_ADDRESS env var) */
  from?: string;
  /** Reply-to address */
  replyTo?: string;
}

export interface SendEmailResult {
  /** Whether the email was sent successfully */
  success: boolean;
  /** Error message if sending failed */
  error?: string;
}

// ---------------------------------------------------------------------------
// Template output
// ---------------------------------------------------------------------------

export interface EmailContent {
  /** Email subject line */
  subject: string;
  /** HTML body (with inline CSS, table-based layout) */
  html: string;
  /** Plain-text fallback */
  text: string;
}

// ---------------------------------------------------------------------------
// Template params
// ---------------------------------------------------------------------------

export interface InviteEmailParams {
  /** Recipient email address */
  recipientEmail: string;
  /** Name of the organization the user is being invited to */
  organizationName: string;
  /** Name of the person sending the invite */
  inviterName: string;
  /** Role the invited user will have (e.g., "Admin", "Member") */
  role: string;
  /** Full URL for the invite acceptance link */
  inviteLink: string;
  /** Number of days until the invite expires */
  expiresInDays: number;
}

export interface TicketReplyNotificationParams {
  /** Email address of the customer to notify */
  recipientEmail: string;
  /** Support ticket subject line */
  ticketSubject: string;
  /** Support ticket display number (e.g., "TKT-0042") */
  ticketNumber: string;
  /** Name of the agent who replied, or "Support Team" */
  agentName: string;
  /** First 200 characters of the reply content */
  replyPreview: string;
  /** Full URL to view the ticket */
  ticketLink: string;
}

export interface TicketAssignmentNotificationParams {
  /** Email address of the agent being assigned */
  recipientEmail: string;
  /** Support ticket subject line */
  ticketSubject: string;
  /** Support ticket display number (e.g., "TKT-0042") */
  ticketNumber: string;
  /** Name of the customer who submitted the ticket */
  customerName: string;
  /** Ticket priority level */
  priority: string;
  /** Full URL to the ticket in the admin portal */
  ticketLink: string;
}
