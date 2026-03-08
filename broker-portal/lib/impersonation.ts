import { cookies } from 'next/headers';
import { verifyCookieValue } from './cookie-signing';
import { createServiceClient } from './supabase/service';

export interface ImpersonationSession {
  session_id: string;
  target_user_id: string;
  admin_user_id: string;
  target_email: string;
  target_name: string;
  expires_at: string;
  started_at: string;
}

export const IMPERSONATION_COOKIE_NAME = 'impersonation_session';

/**
 * Clear the impersonation cookie.
 * Used when DB validation fails (session ended/expired/tampered).
 */
async function clearImpersonationCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE_NAME, '', {
    maxAge: 0,
    path: '/',
  });
}

/**
 * Read impersonation session from cookie (server-side only).
 *
 * Performs two-layer validation:
 * 1. Cookie layer: Verify HMAC-SHA256 signature (TASK-2131)
 * 2. Database layer: Verify session is still active/validated and not expired (TASK-2133)
 *
 * Returns null if no active impersonation, if session is expired,
 * if the cookie signature is invalid, or if the DB session is no longer valid.
 */
export async function getImpersonationSession(): Promise<ImpersonationSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    // TASK-2131: Verify HMAC-SHA256 signature before trusting cookie data.
    // Returns null for unsigned, tampered, or missing-secret scenarios (fail closed).
    const payload = verifyCookieValue(raw);
    if (!payload) return null;

    const session: ImpersonationSession = JSON.parse(payload);

    // Check cookie-level expiry (fast path)
    if (new Date(session.expires_at) <= new Date()) {
      return null;
    }

    // TASK-2133: Validate session against database on each page load.
    // Defense-in-depth: even if the cookie is valid, the DB is authoritative.
    const serviceClient = createServiceClient();
    const { data: dbSession, error } = await serviceClient
      .from('impersonation_sessions')
      .select('id, target_user_id, status, session_expires_at')
      .eq('id', session.session_id)
      .in('status', ['active', 'validated'])
      .gt('session_expires_at', new Date().toISOString())
      .single();

    if (error || !dbSession) {
      // Session not found, ended, expired, or DB error -- clear cookie and fail closed
      await clearImpersonationCookie();
      return null;
    }

    // Defense-in-depth: verify target_user_id matches cookie
    if (dbSession.target_user_id !== session.target_user_id) {
      await clearImpersonationCookie();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
