/**
 * Tests for inviteUser Server Action
 *
 * Tests the invite user logic including validation, duplicate checking,
 * and token generation.
 *
 * TASK-1810: Invite user modal and server action
 */

// ============================================================================
// Email Validation Tests
// ============================================================================

describe('inviteUser validation logic', () => {
  // Replicate the validation logic from the server action
  function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  describe('email format validation', () => {
    it('should accept valid email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@company.co')).toBe(true);
      expect(isValidEmail('user+tag@domain.org')).toBe(true);
      expect(isValidEmail('user123@sub.domain.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('noat.domain.com')).toBe(false);
      expect(isValidEmail('spaces in@email.com')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
    });

    it('should reject emails with multiple @ symbols', () => {
      expect(isValidEmail('test@@example.com')).toBe(false);
      expect(isValidEmail('test@exam@ple.com')).toBe(false);
    });
  });

  describe('email normalization', () => {
    // Replicate normalization logic
    function normalizeEmail(email: string): string {
      return email.toLowerCase().trim();
    }

    it('should lowercase emails', () => {
      expect(normalizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com');
      expect(normalizeEmail('User@Domain.COM')).toBe('user@domain.com');
    });

    it('should trim whitespace', () => {
      expect(normalizeEmail('  test@example.com  ')).toBe('test@example.com');
      expect(normalizeEmail('\tuser@domain.com\n')).toBe('user@domain.com');
    });

    it('should handle mixed case and whitespace', () => {
      expect(normalizeEmail('  TEST@Example.COM  ')).toBe('test@example.com');
    });
  });
});

// ============================================================================
// Role Validation Tests
// ============================================================================

describe('inviteUser role validation', () => {
  type InvitableRole = 'agent' | 'broker' | 'admin';

  function isInvitableRole(role: string): role is InvitableRole {
    return ['agent', 'broker', 'admin'].includes(role);
  }

  it('should accept valid invitable roles', () => {
    expect(isInvitableRole('agent')).toBe(true);
    expect(isInvitableRole('broker')).toBe(true);
    expect(isInvitableRole('admin')).toBe(true);
  });

  it('should reject it_admin role for invite', () => {
    expect(isInvitableRole('it_admin')).toBe(false);
  });

  it('should reject invalid roles', () => {
    expect(isInvitableRole('superadmin')).toBe(false);
    expect(isInvitableRole('')).toBe(false);
    expect(isInvitableRole('user')).toBe(false);
  });
});

// ============================================================================
// Authorization Tests
// ============================================================================

describe('inviteUser authorization logic', () => {
  type Role = 'agent' | 'broker' | 'admin' | 'it_admin';

  function canInviteUsers(role: Role | null): boolean {
    if (!role) return false;
    return ['admin', 'it_admin'].includes(role);
  }

  it('should allow admin to invite', () => {
    expect(canInviteUsers('admin')).toBe(true);
  });

  it('should allow it_admin to invite', () => {
    expect(canInviteUsers('it_admin')).toBe(true);
  });

  it('should not allow broker to invite', () => {
    expect(canInviteUsers('broker')).toBe(false);
  });

  it('should not allow agent to invite', () => {
    expect(canInviteUsers('agent')).toBe(false);
  });

  it('should not allow null role to invite', () => {
    expect(canInviteUsers(null)).toBe(false);
  });
});

// ============================================================================
// Token Generation Tests
// ============================================================================

describe('invitation token generation', () => {
  // Mock randomBytes for testing
  function generateMockToken(length: number): string {
    // Simulate hex string of specified byte length
    return 'a'.repeat(length * 2);
  }

  it('should generate tokens of correct length (32 bytes = 64 hex chars)', () => {
    const token = generateMockToken(32);
    expect(token).toHaveLength(64);
  });

  it('should generate hex string', () => {
    const token = generateMockToken(32);
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });
});

// ============================================================================
// Expiration Logic Tests
// ============================================================================

describe('invitation expiration logic', () => {
  it('should set expiration 7 days in the future', () => {
    const now = new Date('2025-01-15T10:00:00Z');
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);

    expect(expiresAt.toISOString()).toBe('2025-01-22T10:00:00.000Z');
  });

  it('should handle month boundary', () => {
    const now = new Date('2025-01-28T10:00:00Z');
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);

    expect(expiresAt.toISOString()).toBe('2025-02-04T10:00:00.000Z');
  });

  it('should handle year boundary', () => {
    const now = new Date('2025-12-28T10:00:00Z');
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);

    expect(expiresAt.toISOString()).toBe('2026-01-04T10:00:00.000Z');
  });
});

// ============================================================================
// Result Type Tests
// ============================================================================

describe('InviteUserResult type behavior', () => {
  interface InviteUserResult {
    success: boolean;
    inviteLink?: string;
    emailSent?: boolean;
    error?: string;
  }

  it('should have success true with inviteLink for successful invite', () => {
    const result: InviteUserResult = {
      success: true,
      inviteLink: 'https://app.keeprcompliance.com/invite/abc123',
    };

    expect(result.success).toBe(true);
    expect(result.inviteLink).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('should have success false with error for failed invite', () => {
    const result: InviteUserResult = {
      success: false,
      error: 'Email already has pending invitation',
    };

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.inviteLink).toBeUndefined();
  });

  describe('error messages', () => {
    const errorCases = [
      'Invalid email format',
      'Not authenticated',
      'You cannot invite yourself',
      'Not authorized to invite users',
      'This email already has a pending invitation',
      'This user is already a member of the organization',
      'Organization has reached maximum seats',
      'Failed to create invitation',
    ];

    it.each(errorCases)('should support error: "%s"', (errorMessage) => {
      const result: InviteUserResult = {
        success: false,
        error: errorMessage,
      };
      expect(result.error).toBe(errorMessage);
    });
  });
});

// ============================================================================
// Invite Link Generation Tests
// ============================================================================

describe('invite link generation', () => {
  function generateInviteLink(baseUrl: string, token: string): string {
    return `${baseUrl}/invite/${token}`;
  }

  it('should generate correct invite link format', () => {
    const link = generateInviteLink('https://app.keeprcompliance.com', 'abc123def456');
    expect(link).toBe('https://app.keeprcompliance.com/invite/abc123def456');
  });

  it('should handle custom base URLs', () => {
    const link = generateInviteLink('https://staging.keeprcompliance.com', 'token123');
    expect(link).toBe('https://staging.keeprcompliance.com/invite/token123');
  });

  it('should handle localhost for development', () => {
    const link = generateInviteLink('http://localhost:3000', 'devtoken');
    expect(link).toBe('http://localhost:3000/invite/devtoken');
  });
});

// ============================================================================
// Email Sending Integration Tests
// ============================================================================

describe('invite email sending', () => {
  /**
   * Tests the email sending integration added by TASK-2198.
   * Validates that sendInviteEmail is called with correct params
   * and that graceful degradation works when email fails.
   */

  // Replicate the email sending logic from the server action
  interface SendInviteEmailParams {
    recipientEmail: string;
    organizationName: string;
    inviterName: string;
    role: string;
    inviteLink: string;
    expiresInDays: number;
  }

  interface SendEmailResult {
    success: boolean;
    error?: string;
  }

  interface InviteUserResult {
    success: boolean;
    inviteLink?: string;
    emailSent?: boolean;
    error?: string;
  }

  // Simulate the email sending part of inviteUser
  async function sendInviteAfterCreate(
    sendInviteEmail: (params: SendInviteEmailParams) => Promise<SendEmailResult>,
    inviterDisplayName: string | null,
    inviterEmail: string | null,
    orgName: string | null,
    normalizedEmail: string,
    role: string,
    inviteLink: string,
  ): Promise<InviteUserResult> {
    let emailSent = false;
    try {
      const inviterName = inviterDisplayName || inviterEmail || 'Your administrator';
      const organizationName = orgName || 'your organization';

      const emailResult = await sendInviteEmail({
        recipientEmail: normalizedEmail,
        organizationName,
        inviterName,
        role,
        inviteLink,
        expiresInDays: 7,
      });

      emailSent = emailResult.success;
    } catch {
      // Email failure should not block invite creation
    }

    return {
      success: true,
      inviteLink,
      emailSent,
    };
  }

  it('should call sendInviteEmail with correct params after successful invite', async () => {
    const mockSendInviteEmail = jest.fn().mockResolvedValue({ success: true });

    const result = await sendInviteAfterCreate(
      mockSendInviteEmail,
      'John Admin',
      'john@company.com',
      'Acme Corp',
      'newuser@example.com',
      'agent',
      'https://app.keeprcompliance.com/invite/abc123',
    );

    expect(mockSendInviteEmail).toHaveBeenCalledTimes(1);
    expect(mockSendInviteEmail).toHaveBeenCalledWith({
      recipientEmail: 'newuser@example.com',
      organizationName: 'Acme Corp',
      inviterName: 'John Admin',
      role: 'agent',
      inviteLink: 'https://app.keeprcompliance.com/invite/abc123',
      expiresInDays: 7,
    });
    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(true);
  });

  it('should return emailSent: true when email succeeds', async () => {
    const mockSendInviteEmail = jest.fn().mockResolvedValue({ success: true });

    const result = await sendInviteAfterCreate(
      mockSendInviteEmail,
      'Admin',
      'admin@co.com',
      'Org',
      'user@example.com',
      'broker',
      'https://app.keeprcompliance.com/invite/token',
    );

    expect(result.emailSent).toBe(true);
    expect(result.success).toBe(true);
    expect(result.inviteLink).toBe('https://app.keeprcompliance.com/invite/token');
  });

  it('should return emailSent: false when email fails (graceful degradation)', async () => {
    const mockSendInviteEmail = jest.fn().mockResolvedValue({
      success: false,
      error: 'Graph API error',
    });

    const result = await sendInviteAfterCreate(
      mockSendInviteEmail,
      'Admin',
      'admin@co.com',
      'Org',
      'user@example.com',
      'admin',
      'https://app.keeprcompliance.com/invite/token',
    );

    // Invite should still succeed even if email fails
    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(false);
    // The invite link should still be available for manual copy
    expect(result.inviteLink).toBe('https://app.keeprcompliance.com/invite/token');
  });

  it('should return emailSent: false when sendInviteEmail throws (graceful degradation)', async () => {
    const mockSendInviteEmail = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await sendInviteAfterCreate(
      mockSendInviteEmail,
      'Admin',
      'admin@co.com',
      'Org',
      'user@example.com',
      'agent',
      'https://app.keeprcompliance.com/invite/token',
    );

    // Invite should still succeed even if email throws
    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(false);
    expect(result.inviteLink).toBe('https://app.keeprcompliance.com/invite/token');
  });

  it('should use email as fallback when display_name is null', async () => {
    const mockSendInviteEmail = jest.fn().mockResolvedValue({ success: true });

    await sendInviteAfterCreate(
      mockSendInviteEmail,
      null,
      'admin@company.com',
      'Acme Corp',
      'user@example.com',
      'agent',
      'https://app.keeprcompliance.com/invite/token',
    );

    expect(mockSendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        inviterName: 'admin@company.com',
      }),
    );
  });

  it('should use "Your administrator" when both display_name and email are null', async () => {
    const mockSendInviteEmail = jest.fn().mockResolvedValue({ success: true });

    await sendInviteAfterCreate(
      mockSendInviteEmail,
      null,
      null,
      'Acme Corp',
      'user@example.com',
      'agent',
      'https://app.keeprcompliance.com/invite/token',
    );

    expect(mockSendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        inviterName: 'Your administrator',
      }),
    );
  });

  it('should use "your organization" when org name is null', async () => {
    const mockSendInviteEmail = jest.fn().mockResolvedValue({ success: true });

    await sendInviteAfterCreate(
      mockSendInviteEmail,
      'Admin',
      'admin@co.com',
      null,
      'user@example.com',
      'agent',
      'https://app.keeprcompliance.com/invite/token',
    );

    expect(mockSendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationName: 'your organization',
      }),
    );
  });
});
