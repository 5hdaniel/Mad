/**
 * Session Database Service
 * Handles all session-related database operations
 */

import crypto from "crypto";
import type { Session, User } from "../../types";
import { dbGet, dbRun } from "./core/dbConnection";

/**
 * Create a new session for a user
 */
export async function createSession(userId: string): Promise<string> {
  const id = crypto.randomUUID();
  const sessionToken = crypto.randomUUID();

  // Sessions expire after 24 hours (security hardened)
  const expiresAt = new Date();
  expiresAt.setTime(expiresAt.getTime() + 24 * 60 * 60 * 1000);

  const sql = `
    INSERT INTO sessions (id, user_id, session_token, expires_at)
    VALUES (?, ?, ?, ?)
  `;

  dbRun(sql, [id, userId, sessionToken, expiresAt.toISOString()]);
  return sessionToken;
}

/**
 * Validate a session token
 */
export async function validateSession(
  sessionToken: string,
): Promise<(Session & User) | null> {
  const sql = `
    SELECT s.*, u.*
    FROM sessions s
    JOIN users_local u ON s.user_id = u.id
    WHERE s.session_token = ?
  `;

  const session = dbGet<Session & User>(sql, [sessionToken]);

  if (!session) {
    return null;
  }

  // Check if expired
  const expiresAt = new Date(session.expires_at);
  if (expiresAt < new Date()) {
    await deleteSession(sessionToken);
    return null;
  }

  // Update last accessed time
  dbRun(
    "UPDATE sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE session_token = ?",
    [sessionToken],
  );

  return session;
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(sessionToken: string): Promise<void> {
  const sql = "DELETE FROM sessions WHERE session_token = ?";
  dbRun(sql, [sessionToken]);
}

/**
 * Delete all sessions for a user
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  const sql = "DELETE FROM sessions WHERE user_id = ?";
  dbRun(sql, [userId]);
}

/**
 * Clear all sessions (for session-only OAuth on app startup)
 * This forces all users to re-authenticate each app launch
 */
export async function clearAllSessions(): Promise<void> {
  const sql = "DELETE FROM sessions";
  dbRun(sql, []);
  console.log("[SessionDbService] Cleared all sessions for session-only OAuth");
}
