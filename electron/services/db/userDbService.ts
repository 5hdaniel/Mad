/**
 * User Database Service
 * Handles all user-related database operations
 */

import crypto from "crypto";
import type { User, NewUser, OAuthProvider } from "../../types";
import { DatabaseError, NotFoundError } from "../../types";
import { dbGet, dbRun } from "./core/dbConnection";
import { validateFields } from "../../utils/sqlFieldWhitelist";

/**
 * Create a new user
 */
export async function createUser(userData: NewUser): Promise<User> {
  const id = crypto.randomUUID();
  const sql = `
    INSERT INTO users_local (
      id, email, first_name, last_name, display_name, avatar_url,
      oauth_provider, oauth_id, subscription_tier, subscription_status,
      trial_ends_at, timezone, theme, company, job_title
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    id,
    userData.email,
    userData.first_name || null,
    userData.last_name || null,
    userData.display_name || null,
    userData.avatar_url || null,
    userData.oauth_provider,
    userData.oauth_id,
    userData.subscription_tier || "free",
    userData.subscription_status || "trial",
    userData.trial_ends_at || null,
    userData.timezone || "America/Los_Angeles",
    userData.theme || "light",
    userData.company || null,
    userData.job_title || null,
  ];

  dbRun(sql, params);
  const user = await getUserById(id);
  if (!user) {
    throw new DatabaseError("Failed to create user");
  }
  return user;
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const sql = "SELECT * FROM users_local WHERE id = ?";
  const user = dbGet<User>(sql, [userId]);
  return user || null;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const sql = "SELECT * FROM users_local WHERE email = ?";
  const user = dbGet<User>(sql, [email]);
  return user || null;
}

/**
 * Get user by OAuth provider and ID
 */
export async function getUserByOAuthId(
  provider: OAuthProvider,
  oauthId: string,
): Promise<User | null> {
  const sql =
    "SELECT * FROM users_local WHERE oauth_provider = ? AND oauth_id = ?";
  const user = dbGet<User>(sql, [provider, oauthId]);
  return user || null;
}

/**
 * Update user data
 */
export async function updateUser(
  userId: string,
  updates: Partial<User>,
): Promise<void> {
  const allowedFields = [
    "email",
    "first_name",
    "last_name",
    "display_name",
    "avatar_url",
    "subscription_tier",
    "subscription_status",
    "trial_ends_at",
    "timezone",
    "theme",
    "notification_preferences",
    "company",
    "job_title",
    "last_cloud_sync_at",
    "terms_accepted_at",
    "privacy_policy_accepted_at",
    "terms_version_accepted",
    "privacy_policy_version_accepted",
    "email_onboarding_completed_at",
    "mobile_phone_type",
  ];

  const fields: string[] = [];
  const values: unknown[] = [];

  Object.keys(updates).forEach((key) => {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push((updates as Record<string, unknown>)[key]);
    }
  });

  if (fields.length === 0) {
    throw new DatabaseError("No valid fields to update");
  }

  // Validate fields against whitelist before SQL construction
  validateFields("users_local", fields);

  values.push(userId);

  const sql = `UPDATE users_local SET ${fields.join(", ")} WHERE id = ?`;
  dbRun(sql, values);
}

/**
 * Delete user
 */
export async function deleteUser(userId: string): Promise<void> {
  const sql = "DELETE FROM users_local WHERE id = ?";
  dbRun(sql, [userId]);
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(userId: string): Promise<void> {
  const sql = `
    UPDATE users_local
    SET last_login_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  dbRun(sql, [userId]);
}

/**
 * Accept terms and conditions for a user
 */
export async function acceptTerms(
  userId: string,
  termsVersion: string,
  privacyVersion: string,
): Promise<User> {
  const sql = `
    UPDATE users_local
    SET terms_accepted_at = CURRENT_TIMESTAMP,
        terms_version_accepted = ?,
        privacy_policy_accepted_at = CURRENT_TIMESTAMP,
        privacy_policy_version_accepted = ?
    WHERE id = ?
  `;
  dbRun(sql, [termsVersion, privacyVersion, userId]);
  const user = await getUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found after accepting terms", "User", userId);
  }
  return user;
}

/**
 * Mark email onboarding as completed for a user
 */
export async function completeEmailOnboarding(userId: string): Promise<void> {
  const sql = `
    UPDATE users_local
    SET email_onboarding_completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  dbRun(sql, [userId]);
}

/**
 * Check if user has completed email onboarding
 */
export async function hasCompletedEmailOnboarding(
  userId: string,
): Promise<boolean> {
  const sql = `
    SELECT email_onboarding_completed_at
    FROM users_local
    WHERE id = ?
  `;
  const result = dbGet<{ email_onboarding_completed_at: string | null }>(sql, [
    userId,
  ]);
  return (
    result?.email_onboarding_completed_at !== null &&
    result?.email_onboarding_completed_at !== undefined
  );
}
