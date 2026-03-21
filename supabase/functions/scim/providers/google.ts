/**
 * Google Workspace - SCIM Provider (Stub)
 *
 * Placeholder for Google Workspace SCIM provisioning support.
 * Implementation planned in TASK-2306.
 *
 * Google Workspace SCIM behavior notes (for future implementation):
 * - Google uses slightly different attribute mappings
 * - userName is the primary email
 * - Groups are managed via Google Admin SDK, not SCIM
 * - Custom schemas may be needed for Google-specific attributes
 *
 * @see TASK-2306 for full implementation requirements
 */

/** Google Workspace SCIM provider identifier */
export const GOOGLE_PROVIDER_ID = "google" as const;

/**
 * Interface for Google Workspace SCIM provider.
 * To be implemented in TASK-2306.
 */
export interface GoogleScimProvider {
  /** Provider identifier */
  readonly providerId: typeof GOOGLE_PROVIDER_ID;

  /**
   * Normalize a Google Workspace SCIM user payload into the
   * internal user representation.
   */
  normalizePayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown>;

  /**
   * Extract the primary email from a Google SCIM payload.
   * Google may send emails in a different format than Azure.
   */
  extractPrimaryEmail(
    payload: Record<string, unknown>,
  ): string | null;
}
