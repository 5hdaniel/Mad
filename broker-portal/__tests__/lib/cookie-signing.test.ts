/**
 * Tests for Cookie Signing Utility (HMAC-SHA256)
 *
 * Verifies that signCookieValue() and verifyCookieValue() correctly
 * sign and verify cookie payloads, rejecting tampered or unsigned values.
 *
 * TASK-2131: Sign Impersonation Cookie
 */

import crypto from 'crypto';

// We need to control the env var for tests, so we use dynamic imports
// after setting process.env

const TEST_SECRET = 'test-secret-key-at-least-32-characters-long';
const TEST_PAYLOAD = JSON.stringify({
  session_id: 'sess-123',
  target_user_id: 'user-456',
  admin_user_id: 'admin-789',
  target_email: 'user@example.com',
  target_name: 'Test User',
  expires_at: '2099-12-31T23:59:59Z',
  started_at: '2026-01-01T00:00:00Z',
});

/**
 * Helper: compute the expected HMAC-SHA256 signature for a payload.
 */
function computeExpectedSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

describe('cookie-signing', () => {
  let signCookieValue: (payload: string) => string;
  let verifyCookieValue: (signedValue: string) => string | null;

  beforeEach(() => {
    // Reset module cache so env changes take effect
    jest.resetModules();
    process.env.IMPERSONATION_COOKIE_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.IMPERSONATION_COOKIE_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  async function loadModule() {
    const mod = await import('../../lib/cookie-signing');
    signCookieValue = mod.signCookieValue;
    verifyCookieValue = mod.verifyCookieValue;
  }

  // ============================================================================
  // signCookieValue Tests
  // ============================================================================

  describe('signCookieValue', () => {
    it('should produce deterministic output for the same payload and secret', async () => {
      await loadModule();
      const result1 = signCookieValue(TEST_PAYLOAD);
      const result2 = signCookieValue(TEST_PAYLOAD);
      expect(result1).toBe(result2);
    });

    it('should produce payload.signature format', async () => {
      await loadModule();
      const result = signCookieValue(TEST_PAYLOAD);
      const lastDot = result.lastIndexOf('.');
      expect(lastDot).toBeGreaterThan(0);

      const payload = result.substring(0, lastDot);
      const signature = result.substring(lastDot + 1);

      expect(payload).toBe(TEST_PAYLOAD);
      expect(signature).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce correct HMAC-SHA256 signature', async () => {
      await loadModule();
      const result = signCookieValue(TEST_PAYLOAD);
      const signature = result.substring(result.lastIndexOf('.') + 1);
      const expected = computeExpectedSignature(TEST_PAYLOAD, TEST_SECRET);
      expect(signature).toBe(expected);
    });

    it('should throw if no secret is configured', async () => {
      delete process.env.IMPERSONATION_COOKIE_SECRET;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      await loadModule();
      expect(() => signCookieValue(TEST_PAYLOAD)).toThrow(
        'IMPERSONATION_COOKIE_SECRET not configured'
      );
    });

    it('should use SUPABASE_SERVICE_ROLE_KEY as fallback', async () => {
      delete process.env.IMPERSONATION_COOKIE_SECRET;
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'fallback-service-role-key-32-chars-plus';
      await loadModule();
      const result = signCookieValue(TEST_PAYLOAD);
      const signature = result.substring(result.lastIndexOf('.') + 1);
      const expected = computeExpectedSignature(
        TEST_PAYLOAD,
        'fallback-service-role-key-32-chars-plus'
      );
      expect(signature).toBe(expected);
    });

    it('should produce different signatures for different payloads', async () => {
      await loadModule();
      const result1 = signCookieValue('payload-1');
      const result2 = signCookieValue('payload-2');
      const sig1 = result1.substring(result1.lastIndexOf('.') + 1);
      const sig2 = result2.substring(result2.lastIndexOf('.') + 1);
      expect(sig1).not.toBe(sig2);
    });
  });

  // ============================================================================
  // verifyCookieValue Tests
  // ============================================================================

  describe('verifyCookieValue', () => {
    it('should return payload for a valid signed value', async () => {
      await loadModule();
      const signed = signCookieValue(TEST_PAYLOAD);
      const result = verifyCookieValue(signed);
      expect(result).toBe(TEST_PAYLOAD);
    });

    it('should return null for unsigned (plain JSON) cookie', async () => {
      await loadModule();
      // Plain JSON has no dot-separated signature
      const result = verifyCookieValue(TEST_PAYLOAD);
      // JSON with curly braces will have a lastIndexOf('.') but the "signature"
      // part won't be valid hex. This should return null.
      expect(result).toBeNull();
    });

    it('should return null for tampered payload', async () => {
      await loadModule();
      const signed = signCookieValue(TEST_PAYLOAD);
      const lastDot = signed.lastIndexOf('.');
      const signature = signed.substring(lastDot + 1);

      // Tamper with payload
      const tamperedPayload = TEST_PAYLOAD.replace('user-456', 'user-HACKED');
      const tampered = `${tamperedPayload}.${signature}`;

      const result = verifyCookieValue(tampered);
      expect(result).toBeNull();
    });

    it('should return null for tampered signature', async () => {
      await loadModule();
      const signed = signCookieValue(TEST_PAYLOAD);
      const lastDot = signed.lastIndexOf('.');
      const payload = signed.substring(0, lastDot);

      // Replace signature with a different valid hex string
      const fakeSignature = 'a'.repeat(64);
      const tampered = `${payload}.${fakeSignature}`;

      const result = verifyCookieValue(tampered);
      expect(result).toBeNull();
    });

    it('should return null if secret is missing (fail closed)', async () => {
      delete process.env.IMPERSONATION_COOKIE_SECRET;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      await loadModule();

      // Create a validly-formatted signed value (but we can't verify without secret)
      const fakeSigned = `${TEST_PAYLOAD}.${'ab'.repeat(32)}`;
      const result = verifyCookieValue(fakeSigned);
      expect(result).toBeNull();
    });

    it('should return null for empty string', async () => {
      await loadModule();
      const result = verifyCookieValue('');
      expect(result).toBeNull();
    });

    it('should return null for string without dot separator', async () => {
      await loadModule();
      const result = verifyCookieValue('no-dot-separator');
      expect(result).toBeNull();
    });

    it('should return null for invalid signature format (non-hex)', async () => {
      await loadModule();
      const result = verifyCookieValue(`${TEST_PAYLOAD}.not-valid-hex!`);
      expect(result).toBeNull();
    });

    it('should return null for signature of wrong length', async () => {
      await loadModule();
      const result = verifyCookieValue(`${TEST_PAYLOAD}.abcdef`);
      expect(result).toBeNull();
    });

    it('should handle payload containing dots correctly', async () => {
      await loadModule();
      const payloadWithDots = '{"key":"value.with.dots","other":"data"}';
      const signed = signCookieValue(payloadWithDots);
      const result = verifyCookieValue(signed);
      expect(result).toBe(payloadWithDots);
    });

    it('should round-trip a realistic impersonation session', async () => {
      await loadModule();
      const session = {
        session_id: 'abc-def-123',
        target_user_id: 'target-user-uuid',
        admin_user_id: 'admin-user-uuid',
        target_email: 'target@company.com',
        target_name: 'Target User',
        expires_at: '2099-06-15T14:30:00.000Z',
        started_at: '2026-03-07T12:00:00.000Z',
      };
      const payload = JSON.stringify(session);
      const signed = signCookieValue(payload);
      const verified = verifyCookieValue(signed);
      expect(verified).toBe(payload);
      expect(JSON.parse(verified!)).toEqual(session);
    });
  });
});
