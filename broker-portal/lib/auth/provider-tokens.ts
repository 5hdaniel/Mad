/**
 * Provider Token Utilities
 *
 * Encrypt/decrypt provider OAuth tokens for storage in the provider_tokens table.
 * Get a valid Microsoft access token with automatic refresh when expired.
 *
 * Required env vars:
 * - PROVIDER_TOKEN_ENCRYPTION_KEY: 64-char hex key (generate with: openssl rand -hex 32)
 * - AZURE_AD_CLIENT_ID: Azure AD app registration client ID
 * - AZURE_AD_CLIENT_SECRET: Azure AD app registration client secret
 * - AZURE_AD_TENANT_ID: Azure AD tenant ID
 */

import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

// AES-256-GCM constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Get the encryption key from environment variable.
 * Throws if not configured (server-side only).
 */
function getEncryptionKey(): Buffer {
  const key = process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'PROVIDER_TOKEN_ENCRYPTION_KEY is not set. Generate with: openssl rand -hex 32'
    );
  }
  if (key.length !== 64) {
    throw new Error(
      'PROVIDER_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'
    );
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a plaintext token for storage in the database.
 * Uses AES-256-GCM with a random IV prepended to the ciphertext.
 *
 * Output format: base64(IV || authTag || ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine IV + authTag + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt an encrypted token retrieved from the database.
 * Expects format: base64(IV || authTag || ciphertext)
 */
export function decrypt(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, 'base64');

  // Extract IV, authTag, and ciphertext
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/** Buffer time before expiry to trigger a refresh (5 minutes) */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Get a valid Microsoft access token for the given user.
 *
 * 1. Reads the encrypted token from the provider_tokens table
 * 2. If not expired (with 5-minute buffer), decrypts and returns it
 * 3. If expired and a refresh token exists, refreshes via Microsoft token endpoint
 * 4. Encrypts and stores the new tokens, then returns the new access token
 * 5. Returns null if no token found or refresh fails
 *
 * Note: expires_at is approximate (~1 hour from login time) since Supabase
 * does not expose the provider's exact expires_in value.
 */
export async function getMicrosoftToken(userId: string): Promise<string | null> {
  const supabase = await createClient();

  // 1. Fetch token record from provider_tokens
  const { data: tokenRecord, error } = await supabase
    .from('provider_tokens')
    .select('access_token_encrypted, refresh_token_encrypted, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'microsoft')
    .single();

  if (error || !tokenRecord) {
    console.warn('No Microsoft provider token found for user:', userId);
    return null;
  }

  // 2. Check if token is still valid (with buffer)
  const expiresAt = new Date(tokenRecord.expires_at).getTime();
  const now = Date.now();

  if (now < expiresAt - REFRESH_BUFFER_MS) {
    // Token is still valid -- decrypt and return
    try {
      return decrypt(tokenRecord.access_token_encrypted);
    } catch (decryptError) {
      console.error('Failed to decrypt access token:', decryptError);
      return null;
    }
  }

  // 3. Token expired or expiring soon -- try to refresh
  if (!tokenRecord.refresh_token_encrypted) {
    console.warn('Microsoft token expired and no refresh token available for user:', userId);
    return null;
  }

  // Validate required env vars for token refresh
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  const tenantId = process.env.AZURE_AD_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    console.error(
      'Missing Azure AD env vars (AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID). ' +
        'Token refresh is not possible without these.'
    );
    return null;
  }

  let refreshToken: string;
  try {
    refreshToken = decrypt(tokenRecord.refresh_token_encrypted);
  } catch (decryptError) {
    console.error('Failed to decrypt refresh token:', decryptError);
    return null;
  }

  // 4. Call Microsoft token endpoint to refresh
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'openid profile email Contacts.Read offline_access',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Microsoft token refresh failed:', response.status, errorBody);
      return null;
    }

    const tokenResponse = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    // 5. Encrypt and store the new tokens
    const newExpiresAt = new Date(
      Date.now() + tokenResponse.expires_in * 1000
    ).toISOString();

    const { error: updateError } = await supabase
      .from('provider_tokens')
      .update({
        access_token_encrypted: encrypt(tokenResponse.access_token),
        // Microsoft may return a new refresh token (rotation)
        refresh_token_encrypted: tokenResponse.refresh_token
          ? encrypt(tokenResponse.refresh_token)
          : tokenRecord.refresh_token_encrypted,
        expires_at: newExpiresAt,
      })
      .eq('user_id', userId)
      .eq('provider', 'microsoft');

    if (updateError) {
      console.error('Failed to update refreshed token:', updateError);
      // Still return the new access token even if DB update fails
    }

    return tokenResponse.access_token;
  } catch (fetchError) {
    console.error('Error calling Microsoft token endpoint:', fetchError);
    return null;
  }
}
