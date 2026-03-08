/**
 * Cookie Signing Utility - HMAC-SHA256
 *
 * Signs and verifies cookie values to prevent tampering.
 * Uses HMAC-SHA256 with a server-side secret for integrity protection.
 *
 * Cookie format: {json_payload}.{hex_signature}
 *
 * TASK-2131: Sign Impersonation Cookie
 */

import crypto from 'crypto';

/**
 * Get the cookie signing secret.
 * Falls back to SUPABASE_SERVICE_ROLE_KEY if IMPERSONATION_COOKIE_SECRET is not set.
 */
function getCookieSecret(): string | undefined {
  return process.env.IMPERSONATION_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Sign a cookie value with HMAC-SHA256.
 *
 * @param payload - The raw string payload (typically JSON) to sign
 * @returns The signed value in format: {payload}.{hex_signature}
 * @throws Error if no signing secret is configured
 */
export function signCookieValue(payload: string): string {
  const secret = getCookieSecret();
  if (!secret) {
    throw new Error('IMPERSONATION_COOKIE_SECRET not configured');
  }

  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return `${payload}.${signature}`;
}

/**
 * Verify a signed cookie value and extract the payload.
 *
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param signedValue - The signed cookie value in format: {payload}.{hex_signature}
 * @returns The original payload string if valid, or null if invalid/tampered/missing secret
 */
export function verifyCookieValue(signedValue: string): string | null {
  const secret = getCookieSecret();
  if (!secret) return null; // fail closed

  const lastDot = signedValue.lastIndexOf('.');
  if (lastDot === -1) return null;

  const payload = signedValue.substring(0, lastDot);
  const signature = signedValue.substring(lastDot + 1);

  // Validate signature is a valid hex string (64 chars for SHA-256)
  if (!/^[0-9a-f]{64}$/i.test(signature)) return null;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Timing-safe comparison to prevent timing attacks
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
      return null;
    }
  } catch {
    // timingSafeEqual throws if buffers have different lengths
    return null;
  }

  return payload;
}
