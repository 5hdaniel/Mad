/**
 * Tests for the ticket resolved/closed notification API route.
 *
 * Verifies:
 * - Resolved notification sends email via sendTicketResolvedEmail
 * - Closed notification sends email via sendTicketResolvedEmail
 * - Unauthorized requests (missing/wrong secret) return 401
 * - Missing required fields return 400
 * - Invalid status returns 400
 * - Internal errors return 500
 *
 * BACKLOG-1574: Ticket Lifecycle Emails (Resolved/Closed Notifications)
 *
 * @jest-environment node
 */

// ---------------------------------------------------------------------------
// Mock setup -- must be before imports
// ---------------------------------------------------------------------------

const mockSendResolved = jest.fn();

jest.mock('@/lib/email', () => ({
  sendTicketResolvedEmail: mockSendResolved,
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/email/ticket-resolved/route';
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
  return new NextRequest('http://localhost/api/email/ticket-resolved', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/email/ticket-resolved', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setEnv();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  // --- Authentication tests ---

  it('should return 401 when x-api-secret header is missing', async () => {
    const req = makeRequest({ ticketId: 'ticket-1', newStatus: 'resolved' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 401 when x-api-secret header is wrong', async () => {
    const req = makeRequest({ ticketId: 'ticket-1', newStatus: 'resolved' }, 'wrong-secret');
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 401 when INTERNAL_API_SECRET env is not set', async () => {
    setEnv({ INTERNAL_API_SECRET: undefined });
    const req = makeRequest({ ticketId: 'ticket-1', newStatus: 'resolved' }, 'test-secret-123');
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  // --- Validation tests ---

  it('should return 400 when required fields are missing', async () => {
    const req = makeRequest({ ticketId: 'ticket-1' }, 'test-secret-123');
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Missing required fields');
  });

  it('should return 400 when newStatus is invalid', async () => {
    const req = makeRequest(
      {
        ticketId: 'ticket-1',
        ticketNumber: 'TKT-0042',
        ticketSubject: 'Test',
        customerEmail: 'customer@example.com',
        ticketUrl: 'https://portal.keepr.com/support/ticket-1',
        newStatus: 'in_progress',
      },
      'test-secret-123'
    );
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid status: must be resolved or closed');
  });

  // --- Resolved notification tests ---

  it('should send resolved notification and return 200', async () => {
    mockSendResolved.mockResolvedValueOnce({ success: true });

    const req = makeRequest(
      {
        ticketId: 'ticket-1',
        ticketNumber: 'TKT-0042',
        ticketSubject: 'Help with login',
        customerEmail: 'customer@example.com',
        resolutionSummary: 'Password reset link was sent.',
        ticketUrl: 'https://portal.keepr.com/support/ticket-1',
        newStatus: 'resolved',
      },
      'test-secret-123'
    );

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockSendResolved).toHaveBeenCalledWith({
      recipientEmail: 'customer@example.com',
      ticketSubject: 'Help with login',
      ticketNumber: 'TKT-0042',
      resolutionSummary: 'Password reset link was sent.',
      ticketLink: 'https://portal.keepr.com/support/ticket-1',
      newStatus: 'resolved',
    });
  });

  it('should send closed notification and return 200', async () => {
    mockSendResolved.mockResolvedValueOnce({ success: true });

    const req = makeRequest(
      {
        ticketId: 'ticket-2',
        ticketNumber: 'TKT-0099',
        ticketSubject: 'Billing inquiry',
        customerEmail: 'user@example.com',
        ticketUrl: 'https://portal.keepr.com/support/ticket-2',
        newStatus: 'closed',
      },
      'test-secret-123'
    );

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockSendResolved).toHaveBeenCalledWith({
      recipientEmail: 'user@example.com',
      ticketSubject: 'Billing inquiry',
      ticketNumber: 'TKT-0099',
      resolutionSummary: undefined,
      ticketLink: 'https://portal.keepr.com/support/ticket-2',
      newStatus: 'closed',
    });
  });

  it('should return error details when notification fails', async () => {
    mockSendResolved.mockResolvedValueOnce({
      success: false,
      error: 'Graph API error',
    });

    const req = makeRequest(
      {
        ticketId: 'ticket-1',
        ticketNumber: 'TKT-0042',
        ticketSubject: 'Test',
        customerEmail: 'customer@example.com',
        ticketUrl: 'https://portal.keepr.com/support/ticket-1',
        newStatus: 'resolved',
      },
      'test-secret-123'
    );

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Graph API error');
  });

  // --- Error handling tests ---

  it('should return 500 when email service throws', async () => {
    mockSendResolved.mockRejectedValueOnce(new Error('Connection refused'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const req = makeRequest(
      {
        ticketId: 'ticket-1',
        ticketNumber: 'TKT-0042',
        ticketSubject: 'Test',
        customerEmail: 'customer@example.com',
        ticketUrl: 'https://portal.keepr.com/support/ticket-1',
        newStatus: 'resolved',
      },
      'test-secret-123'
    );

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[TicketResolved] Error:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
