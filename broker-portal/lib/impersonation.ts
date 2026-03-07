import { cookies } from 'next/headers';
import { verifyCookieValue } from './cookie-signing';

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
 * Read impersonation session from cookie (server-side only).
 * Returns null if no active impersonation, if session is expired,
 * or if the cookie signature is invalid/missing (TASK-2131).
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

    // Check expiry
    if (new Date(session.expires_at) <= new Date()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
