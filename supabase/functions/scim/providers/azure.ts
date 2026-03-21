/**
 * Azure AD / Microsoft Entra ID - SCIM Provider
 *
 * Azure-specific payload parsing and normalization for SCIM provisioning.
 *
 * Azure AD is the primary SCIM provider. The core SCIM handlers already
 * handle Azure AD's standard SCIM 2.0 payloads, so this module currently
 * contains Azure-specific constants and any future Azure-specific
 * parsing logic that diverges from standard SCIM.
 *
 * Azure AD SCIM behavior notes:
 * - Sends userName as the user's email (UPN)
 * - Uses externalId mapped from the Azure AD object ID
 * - Sends PatchOp with "Replace" operations for user updates
 * - Sets active=false via PatchOp when unassigning users
 * - Filter format: userName eq "email@example.com"
 */

/** Azure AD SCIM provider identifier */
export const AZURE_PROVIDER_ID = "azure" as const;

/**
 * Azure-specific SCIM extension schema URN.
 * Azure AD may include enterprise extension attributes under this schema.
 */
export const AZURE_ENTERPRISE_SCHEMA =
  "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User";

/**
 * Normalize an Azure AD SCIM user payload.
 *
 * Azure AD sends standard SCIM 2.0 payloads, so currently this is a
 * pass-through. If Azure-specific normalization is needed in the future
 * (e.g., mapping enterprise extension attributes), add it here.
 */
export function normalizeAzurePayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  // Currently a pass-through; Azure uses standard SCIM 2.0 format.
  // Future: extract enterprise extension attributes if present.
  return payload;
}
