/**
 * Tests for the ticket notification API route.
 *
 * Verifies:
 * - Reply notification sends email via sendTicketReplyNotification
 * - Assignment notification sends email via sendTicketAssignmentNotification
 * - Unauthorized requests (missing/wrong secret) return 401
 * - Invalid notification type returns 400
 * - Internal errors return 500
 *
 * TASK-2199: Support Ticket Notification Emails
 *
 * @jest-environment node
 */

// ---------------------------------------------------------------------------
// Mock setup -- must be before imports
// ---------------------------------------------------------------------------

const mockSendReply = jest.fn();
const mockSendAssignment = jest.fn();

jest.mock('@/lib/email', () => ({
  sendTicketReplyNotification: mockSendReply,
  sendTicketAssignmentNotification: mockSendAssignment,
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/email/ticket-notification/route';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORIGINAL_ENV = process.env;

function setEnv(overrides: Record<string, string | undefined> = {}): void {
  process.env = {
    ...ORIGINAL_ENV,
    INTERNAL_API_SECRET: 'test-secret-123',
    ...overrides,
  };
}

function makeRequest(
  body: Record<string, unknown>,
  secret?: string
): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (secret !== undefined) {
    headers['x-api-secret'] = secret;
  }
  return new NextRequest('http://localhost/api/email/ticket-notification', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/email/ticket-notification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setEnv();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  // --- Authentication tests ---

  it('should return 401 when x-api-secret header is missing', async () => {
    const req = makeRequest({ type: 'reply' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 401 when x-api-secret header is wrong', async () => {
    const req = makeRequest({ type: 'reply' }, 'wrong-secret');
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 401 when INTERNAL_API_SECRET env is not set', async () => {
    setEnv({ INTERNAL_API_SECRET: undefined });
    const req = makeRequest({ type: 'reply' }, 'test-secret-123');
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  // --- Reply notification tests ---

  it('should send reply notification and return 200', async () => {
    mockSendReply.mockResolvedValueOnce({ success: true });

    const req = makeRequest(
      {
        type: 'reply',
        ticketId: 'ticket-1',
        ticketNumber: 'TKT-0042',
        ticketSubject: 'Help with login',
        customerEmail: 'customer@example.com',
        agentName: 'Agent Smith',
        replyPreview: 'Thank you for reaching out...',
        ticketUrl: 'https://portal.keepr.com/dashboard/support/ticket-1',
      },
      'test-secret-123'
    );

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockSendReply).toHaveBeenCalledWith({
      recipientEmail: 'customer@example.com',
      ticketSubject: 'Help with login',
      ticketNumber: 'TKT-0042',
      agentName: 'Agent Smith',
      replyPreview: 'Thank you for reaching out...',
      ticketLink: 'https://portal.keepr.com/dashboard/support/ticket-1',
    });
    expect(mockSendAssignment).not.toHaveBeenCalled();
  });

  it('should return error details when reply notification fails', async () => {
    mockSendReply.mockResolvedValueOnce({
      success: false,
      error: 'Graph API error',
    });

    const req = makeRequest(
      {
        type: 'reply',
        ticketId: 'ticket-1',
        ticketNumber: 'TKT-0042',
        ticketSubject: 'Test',
        customerEmail: 'customer@example.com',
        agentName: 'Agent',
        replyPreview: 'Preview',
        ticketUrl: 'https://portal.keepr.com/dashboard/support/ticket-1',
      },
      'test-secret-123'
    );

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Graph API error');
  });

  // --- Assignment notification tests ---

  it('should send assignment notification and return 200', async () => {
    mockSendAssignment.mockResolvedValueOnce({ success: true });

    const req = makeRequest(
      {
        type: 'assignment',
        ticketId: 'ticket-2',
        ticketNumber: 'TKT-0099',
        ticketSubject: 'Billing inquiry',
        agentEmail: 'agent@company.com',
        customerName: 'John Doe',
        priority: 'high',
        ticketUrl: 'https://admin.keepr.com/support/ticket-2',
      },
      'test-secret-123'
    );

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockSendAssignment).toHaveBeenCalledWith({
      recipientEmail: 'agent@company.com',
      ticketSubject: 'Billing inquiry',
      ticketNumber: 'TKT-0099',
      customerName: 'John Doe',
      priority: 'high',
      ticketLink: 'https://admin.keepr.com/support/ticket-2',
    });
    expect(mockSendReply).not.toHaveBeenCalled();
  });

  // --- Validation tests ---

  it('should return 400 for invalid notification type', async () => {
    const req = makeRequest(
      { type: 'invalid_type' },
      'test-secret-123'
    );

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid notification type');
  });

  it('should return 400 when type is missing', async () => {
    const req = makeRequest(
      { ticketId: 'ticket-1' },
      'test-secret-123'
    );

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid notification type');
  });

  // --- Error handling tests ---

  it('should return 500 when email service throws', async () => {
    mockSendReply.mockRejectedValueOnce(new Error('Connection refused'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const req = makeRequest(
      {
        type: 'reply',
        ticketId: 'ticket-1',
        ticketNumber: 'TKT-0042',
        ticketSubject: 'Test',
        customerEmail: 'customer@example.com',
        agentName: 'Agent',
        replyPreview: 'Preview',
        ticketUrl: 'https://portal.keepr.com/dashboard/support/ticket-1',
      },
      'test-secret-123'
    );

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[TicketNotification] Error:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
