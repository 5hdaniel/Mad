/**
 * Group-to-Role Mapping Logic
 *
 * Shared utility for resolving a user's Keepr role from their IdP group
 * memberships. Used by both the SCIM handlers and the directory-sync
 * Edge Function.
 *
 * Configuration lives in organization_identity_providers.attribute_mapping:
 * {
 *   "group_role_mapping": {
 *     "group-uuid-1": "admin",
 *     "Keepr Managers": "manager"
 *   },
 *   "default_role": "agent",
 *   "group_sync_enabled": true
 * }
 *
 * Priority: admin > manager > agent
 * When a user belongs to multiple groups, the highest-priority role wins.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GroupRoleMapping {
  /** Map of group ID or display name to Keepr role */
  group_role_mapping: Record<string, string>;
  /** Fallback role when no groups match */
  default_role: string;
  /** Whether group-based role sync is enabled at the org level */
  group_sync_enabled: boolean;
}

export interface RoleResolutionResult {
  /** The resolved Keepr role */
  role: string;
  /** The group that determined the role (null if default was used) */
  matchedGroup: string | null;
  /** Whether a mapping was actually applied (vs. returning default) */
  mappingApplied: boolean;
}

// ---------------------------------------------------------------------------
// Role Priority
// ---------------------------------------------------------------------------

/**
 * Numeric priority for each known role.
 * Higher number = higher privilege.
 */
const ROLE_PRIORITY: Record<string, number> = {
  admin: 3,
  manager: 2,
  agent: 1,
};

/**
 * Get the numeric priority for a role string.
 * Unknown roles get priority 0 (lower than agent).
 */
function getRolePriority(role: string): number {
  return ROLE_PRIORITY[role.toLowerCase()] ?? 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the Keepr role for a user based on their IdP group memberships
 * and the organization's group-to-role mapping configuration.
 *
 * Rules:
 *  1. If group_sync_enabled is false, return default_role (no mapping applied).
 *  2. For each of the user's groups, check if a mapping exists (by ID or name).
 *  3. If multiple groups match, the highest-priority role wins
 *     (admin > manager > agent).
 *  4. If no groups match, return default_role.
 *
 * @param userGroups  Array of group IDs and/or display names from the IdP
 * @param mapping     The group-to-role mapping configuration from the IdP config
 * @returns           The resolved role and metadata about the resolution
 */
export function resolveRole(
  userGroups: string[],
  mapping: GroupRoleMapping,
): RoleResolutionResult {
  // If group sync is disabled, skip mapping entirely
  if (!mapping.group_sync_enabled) {
    return {
      role: mapping.default_role || "agent",
      matchedGroup: null,
      mappingApplied: false,
    };
  }

  // If no groups provided, return default
  if (!userGroups || userGroups.length === 0) {
    return {
      role: mapping.default_role || "agent",
      matchedGroup: null,
      mappingApplied: false,
    };
  }

  // If no mapping rules configured, return default
  const rules = mapping.group_role_mapping;
  if (!rules || Object.keys(rules).length === 0) {
    return {
      role: mapping.default_role || "agent",
      matchedGroup: null,
      mappingApplied: false,
    };
  }

  // Find the highest-priority role among matched groups
  let bestRole: string | null = null;
  let bestPriority = -1;
  let bestGroup: string | null = null;

  for (const group of userGroups) {
    // Check direct match (group ID or exact name)
    const mappedRole = rules[group];
    if (mappedRole) {
      const priority = getRolePriority(mappedRole);
      if (priority > bestPriority) {
        bestPriority = priority;
        bestRole = mappedRole.toLowerCase();
        bestGroup = group;
      }
    }

    // Also check case-insensitive match on group names
    // (IdP may send "Keepr Managers" but mapping has "keepr managers")
    if (!mappedRole) {
      for (const [key, role] of Object.entries(rules)) {
        if (key.toLowerCase() === group.toLowerCase()) {
          const priority = getRolePriority(role);
          if (priority > bestPriority) {
            bestPriority = priority;
            bestRole = role.toLowerCase();
            bestGroup = group;
          }
          break; // Found a match for this group, move to next
        }
      }
    }
  }

  if (bestRole) {
    return {
      role: bestRole,
      matchedGroup: bestGroup,
      mappingApplied: true,
    };
  }

  // No groups matched any mapping rules
  return {
    role: mapping.default_role || "agent",
    matchedGroup: null,
    mappingApplied: false,
  };
}

/**
 * Extract the GroupRoleMapping from an IdP's attribute_mapping JSONB.
 *
 * The attribute_mapping column stores a generic JSONB object. This helper
 * safely extracts the group-related fields with sensible defaults.
 *
 * @param attributeMapping  The raw attribute_mapping JSONB from the database
 * @returns                 A typed GroupRoleMapping with defaults applied
 */
export function extractGroupRoleMapping(
  attributeMapping: Record<string, unknown> | null | undefined,
): GroupRoleMapping {
  if (!attributeMapping) {
    return {
      group_role_mapping: {},
      default_role: "agent",
      group_sync_enabled: false,
    };
  }

  return {
    group_role_mapping:
      (attributeMapping.group_role_mapping as Record<string, string>) || {},
    default_role: (attributeMapping.default_role as string) || "agent",
    group_sync_enabled: attributeMapping.group_sync_enabled === true,
  };
}
