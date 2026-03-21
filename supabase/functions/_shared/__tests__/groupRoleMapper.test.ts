/**
 * Tests for Group-to-Role Mapping Logic
 *
 * Covers: resolveRole(), extractGroupRoleMapping()
 */

import {
  resolveRole,
  extractGroupRoleMapping,
  GroupRoleMapping,
} from "../groupRoleMapper";

// ---------------------------------------------------------------------------
// resolveRole()
// ---------------------------------------------------------------------------

describe("resolveRole", () => {
  const baseMapping: GroupRoleMapping = {
    group_role_mapping: {
      "group-uuid-admin": "admin",
      "group-uuid-manager": "manager",
      "Keepr Agents": "agent",
    },
    default_role: "agent",
    group_sync_enabled: true,
  };

  it("returns the matched role for a single group", () => {
    const result = resolveRole(["group-uuid-admin"], baseMapping);
    expect(result.role).toBe("admin");
    expect(result.matchedGroup).toBe("group-uuid-admin");
    expect(result.mappingApplied).toBe(true);
  });

  it("returns highest-priority role when user is in multiple groups", () => {
    const result = resolveRole(
      ["Keepr Agents", "group-uuid-manager", "group-uuid-admin"],
      baseMapping,
    );
    expect(result.role).toBe("admin");
    expect(result.matchedGroup).toBe("group-uuid-admin");
    expect(result.mappingApplied).toBe(true);
  });

  it("returns manager when user has manager and agent groups", () => {
    const result = resolveRole(
      ["Keepr Agents", "group-uuid-manager"],
      baseMapping,
    );
    expect(result.role).toBe("manager");
    expect(result.matchedGroup).toBe("group-uuid-manager");
    expect(result.mappingApplied).toBe(true);
  });

  it("returns default_role when no groups match", () => {
    const result = resolveRole(["unknown-group-id"], baseMapping);
    expect(result.role).toBe("agent");
    expect(result.matchedGroup).toBeNull();
    expect(result.mappingApplied).toBe(false);
  });

  it("returns default_role when user has no groups", () => {
    const result = resolveRole([], baseMapping);
    expect(result.role).toBe("agent");
    expect(result.matchedGroup).toBeNull();
    expect(result.mappingApplied).toBe(false);
  });

  it("returns default_role when group_sync_enabled is false", () => {
    const disabledMapping: GroupRoleMapping = {
      ...baseMapping,
      group_sync_enabled: false,
    };
    const result = resolveRole(["group-uuid-admin"], disabledMapping);
    expect(result.role).toBe("agent");
    expect(result.matchedGroup).toBeNull();
    expect(result.mappingApplied).toBe(false);
  });

  it("matches group names case-insensitively", () => {
    const result = resolveRole(["keepr agents"], baseMapping);
    expect(result.role).toBe("agent");
    expect(result.matchedGroup).toBe("keepr agents");
    expect(result.mappingApplied).toBe(true);
  });

  it("matches UUIDs as exact keys", () => {
    const mapping: GroupRoleMapping = {
      group_role_mapping: {
        "550e8400-e29b-41d4-a716-446655440000": "admin",
      },
      default_role: "agent",
      group_sync_enabled: true,
    };
    const result = resolveRole(
      ["550e8400-e29b-41d4-a716-446655440000"],
      mapping,
    );
    expect(result.role).toBe("admin");
    expect(result.mappingApplied).toBe(true);
  });

  it("handles empty group_role_mapping", () => {
    const emptyMapping: GroupRoleMapping = {
      group_role_mapping: {},
      default_role: "manager",
      group_sync_enabled: true,
    };
    const result = resolveRole(["some-group"], emptyMapping);
    expect(result.role).toBe("manager");
    expect(result.matchedGroup).toBeNull();
    expect(result.mappingApplied).toBe(false);
  });

  it("uses 'agent' as fallback when default_role is empty", () => {
    const mapping: GroupRoleMapping = {
      group_role_mapping: {},
      default_role: "",
      group_sync_enabled: true,
    };
    const result = resolveRole(["some-group"], mapping);
    expect(result.role).toBe("agent");
  });

  it("normalizes mapped role to lowercase", () => {
    const mapping: GroupRoleMapping = {
      group_role_mapping: { "group-1": "Admin" },
      default_role: "agent",
      group_sync_enabled: true,
    };
    const result = resolveRole(["group-1"], mapping);
    expect(result.role).toBe("admin");
  });

  it("treats unknown mapped roles with lower priority than agent", () => {
    const mapping: GroupRoleMapping = {
      group_role_mapping: {
        "group-custom": "viewer",
        "group-agent": "agent",
      },
      default_role: "agent",
      group_sync_enabled: true,
    };
    // agent has priority 1, viewer has priority 0 -- agent wins
    const result = resolveRole(["group-custom", "group-agent"], mapping);
    expect(result.role).toBe("agent");
    expect(result.matchedGroup).toBe("group-agent");
  });

  it("is idempotent -- same inputs produce same output", () => {
    const groups = ["group-uuid-manager", "group-uuid-admin"];
    const r1 = resolveRole(groups, baseMapping);
    const r2 = resolveRole(groups, baseMapping);
    expect(r1.role).toBe(r2.role);
    expect(r1.matchedGroup).toBe(r2.matchedGroup);
    expect(r1.mappingApplied).toBe(r2.mappingApplied);
  });
});

// ---------------------------------------------------------------------------
// extractGroupRoleMapping()
// ---------------------------------------------------------------------------

describe("extractGroupRoleMapping", () => {
  it("extracts mapping from a full attribute_mapping object", () => {
    const attr = {
      email: "email",
      name: "name",
      groups: "groups",
      group_role_mapping: {
        "group-1": "admin",
        "group-2": "manager",
      },
      default_role: "agent",
      group_sync_enabled: true,
    };

    const result = extractGroupRoleMapping(attr);
    expect(result.group_role_mapping).toEqual({
      "group-1": "admin",
      "group-2": "manager",
    });
    expect(result.default_role).toBe("agent");
    expect(result.group_sync_enabled).toBe(true);
  });

  it("returns safe defaults when attribute_mapping is null", () => {
    const result = extractGroupRoleMapping(null);
    expect(result.group_role_mapping).toEqual({});
    expect(result.default_role).toBe("agent");
    expect(result.group_sync_enabled).toBe(false);
  });

  it("returns safe defaults when attribute_mapping is undefined", () => {
    const result = extractGroupRoleMapping(undefined);
    expect(result.group_role_mapping).toEqual({});
    expect(result.default_role).toBe("agent");
    expect(result.group_sync_enabled).toBe(false);
  });

  it("returns safe defaults when group fields are missing", () => {
    const attr = {
      email: "email",
      name: "name",
    };
    const result = extractGroupRoleMapping(attr);
    expect(result.group_role_mapping).toEqual({});
    expect(result.default_role).toBe("agent");
    expect(result.group_sync_enabled).toBe(false);
  });

  it("treats non-true group_sync_enabled as false", () => {
    const attr = {
      group_sync_enabled: "true", // string, not boolean
    };
    const result = extractGroupRoleMapping(attr);
    expect(result.group_sync_enabled).toBe(false);
  });
});
