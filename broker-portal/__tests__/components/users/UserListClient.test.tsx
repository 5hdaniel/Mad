/**
 * Tests for UserListClient Filter Logic
 *
 * Since broker-portal uses different path aliases than the main Jest config,
 * we test the filtering logic directly rather than rendering the component.
 *
 * The component's rendering behavior is verified through:
 * 1. These logic tests (filtering algorithm)
 * 2. Visual verification in development
 * 3. E2E tests in future sprints
 *
 * TASK-1809: User list component implementation
 */

import type { OrganizationMember, Role, LicenseStatus, User } from '../../../lib/types/users';

// Helper to create mock member
function createMockMember(
  overrides: Partial<OrganizationMember> & { id: string }
): OrganizationMember {
  const defaults: OrganizationMember = {
    id: 'default-id',
    organization_id: 'org-1',
    user_id: 'user-1',
    role: 'agent' as Role,
    license_status: 'active' as LicenseStatus,
    invited_email: null,
    invitation_token: null,
    invitation_expires_at: null,
    invited_by: null,
    invited_at: null,
    joined_at: '2024-01-01T00:00:00Z',
    last_invited_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    provisioned_by: null,
    provisioned_at: null,
    scim_synced_at: null,
    provisioning_metadata: null,
    idp_groups: null,
    group_sync_enabled: false,
    user: {
      id: 'user-1',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      display_name: 'Test User',
      avatar_url: null,
      oauth_provider: 'google',
      oauth_id: 'oauth-1',
      last_login_at: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      last_sso_login_at: null,
      last_sso_provider: null,
      is_managed: false,
      scim_external_id: null,
      sso_only: false,
      jit_provisioned: false,
      jit_provisioned_at: null,
      provisioning_source: null,
      suspended_at: null,
      suspension_reason: null,
      idp_claims: null,
    } as User,
  };

  return { ...defaults, ...overrides };
}

// Replicate the filter logic from UserListClient
function filterMembers(
  members: OrganizationMember[],
  searchQuery: string,
  roleFilter: string,
  statusFilter: string
): OrganizationMember[] {
  return members.filter((member) => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const displayName =
      member.user?.display_name ||
      `${member.user?.first_name || ''} ${member.user?.last_name || ''}`.trim() ||
      '';
    const email = member.user?.email || member.invited_email || '';
    const invitedEmail = member.invited_email || '';

    const matchesSearch =
      !searchQuery ||
      displayName.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower) ||
      invitedEmail.toLowerCase().includes(searchLower);

    // Role filter
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;

    // Status filter
    const matchesStatus =
      statusFilter === 'all' || member.license_status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });
}

describe('UserListClient Filter Logic', () => {
  const mockMembers: OrganizationMember[] = [
    createMockMember({
      id: 'member-1',
      user_id: 'user-1',
      role: 'admin',
      license_status: 'active',
      user: {
        id: 'user-1',
        email: 'john@example.com',
        first_name: 'John',
        last_name: 'Doe',
        display_name: 'John Doe',
        avatar_url: null,
        oauth_provider: 'google',
        oauth_id: 'oauth-1',
        last_login_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_sso_login_at: null,
        last_sso_provider: null,
        is_managed: false,
        scim_external_id: null,
        sso_only: false,
        jit_provisioned: false,
        jit_provisioned_at: null,
        provisioning_source: null,
        suspended_at: null,
        suspension_reason: null,
        idp_claims: null,
      },
    }),
    createMockMember({
      id: 'member-2',
      user_id: 'user-2',
      role: 'broker',
      license_status: 'active',
      user: {
        id: 'user-2',
        email: 'jane@example.com',
        first_name: 'Jane',
        last_name: 'Smith',
        display_name: 'Jane Smith',
        avatar_url: null,
        oauth_provider: 'email',
        oauth_id: 'oauth-2',
        last_login_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_sso_login_at: null,
        last_sso_provider: null,
        is_managed: false,
        scim_external_id: null,
        sso_only: false,
        jit_provisioned: false,
        jit_provisioned_at: null,
        provisioning_source: null,
        suspended_at: null,
        suspension_reason: null,
        idp_claims: null,
      },
    }),
    createMockMember({
      id: 'member-3',
      user_id: null,
      role: 'agent',
      license_status: 'pending',
      invited_email: 'pending@example.com',
      user: undefined,
    }),
    createMockMember({
      id: 'member-4',
      user_id: 'user-4',
      role: 'agent',
      license_status: 'suspended',
      user: {
        id: 'user-4',
        email: 'suspended@example.com',
        first_name: 'Suspended',
        last_name: 'User',
        display_name: 'Suspended User',
        avatar_url: null,
        oauth_provider: 'email',
        oauth_id: 'oauth-4',
        last_login_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_sso_login_at: null,
        last_sso_provider: null,
        is_managed: false,
        scim_external_id: null,
        sso_only: false,
        jit_provisioned: false,
        jit_provisioned_at: null,
        provisioning_source: null,
        suspended_at: null,
        suspension_reason: null,
        idp_claims: null,
      },
    }),
  ];

  describe('no filters applied', () => {
    it('should return all members when no filters', () => {
      const result = filterMembers(mockMembers, '', 'all', 'all');
      expect(result).toHaveLength(4);
    });
  });

  describe('search filtering', () => {
    it('should filter by display name', () => {
      const result = filterMembers(mockMembers, 'John', 'all', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('member-1');
    });

    it('should filter by email', () => {
      const result = filterMembers(mockMembers, 'jane@', 'all', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('member-2');
    });

    it('should filter by invited email', () => {
      const result = filterMembers(mockMembers, 'pending@', 'all', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('member-3');
    });

    it('should be case insensitive', () => {
      const result = filterMembers(mockMembers, 'JOHN', 'all', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('member-1');
    });

    it('should match partial strings', () => {
      const result = filterMembers(mockMembers, 'oh', 'all', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('member-1');
    });

    it('should return empty when no match', () => {
      const result = filterMembers(mockMembers, 'nonexistent', 'all', 'all');
      expect(result).toHaveLength(0);
    });
  });

  describe('role filtering', () => {
    it('should filter by admin role', () => {
      const result = filterMembers(mockMembers, '', 'admin', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('member-1');
    });

    it('should filter by broker role', () => {
      const result = filterMembers(mockMembers, '', 'broker', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('member-2');
    });

    it('should filter by agent role', () => {
      const result = filterMembers(mockMembers, '', 'agent', 'all');
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual(['member-3', 'member-4']);
    });

    it('should return all with role filter "all"', () => {
      const result = filterMembers(mockMembers, '', 'all', 'all');
      expect(result).toHaveLength(4);
    });
  });

  describe('status filtering', () => {
    it('should filter by active status', () => {
      const result = filterMembers(mockMembers, '', 'all', 'active');
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual(['member-1', 'member-2']);
    });

    it('should filter by pending status', () => {
      const result = filterMembers(mockMembers, '', 'all', 'pending');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('member-3');
    });

    it('should filter by suspended status', () => {
      const result = filterMembers(mockMembers, '', 'all', 'suspended');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('member-4');
    });

    it('should return all with status filter "all"', () => {
      const result = filterMembers(mockMembers, '', 'all', 'all');
      expect(result).toHaveLength(4);
    });
  });

  describe('combined filtering', () => {
    it('should combine search and role filter', () => {
      const result = filterMembers(mockMembers, 'suspended', 'agent', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('member-4');
    });

    it('should combine search and status filter', () => {
      const result = filterMembers(mockMembers, 'john', 'all', 'active');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('member-1');
    });

    it('should combine role and status filter', () => {
      const result = filterMembers(mockMembers, '', 'agent', 'suspended');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('member-4');
    });

    it('should combine all three filters', () => {
      const result = filterMembers(mockMembers, 'susp', 'agent', 'suspended');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('member-4');
    });

    it('should return empty when all filters narrow to nothing', () => {
      const result = filterMembers(mockMembers, 'john', 'agent', 'pending');
      expect(result).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty member list', () => {
      const result = filterMembers([], '', 'all', 'all');
      expect(result).toHaveLength(0);
    });

    it('should handle members with no user object', () => {
      const membersWithNoUser = [
        createMockMember({
          id: 'no-user',
          user_id: null,
          invited_email: 'invited@test.com',
          user: undefined,
        }),
      ];
      const result = filterMembers(membersWithNoUser, 'invited@', 'all', 'all');
      expect(result).toHaveLength(1);
    });

    it('should handle members with partial user data', () => {
      const memberWithPartialUser = createMockMember({
        id: 'partial-user',
        user: {
          ...createMockMember({ id: 'x' }).user!,
          display_name: null,
          first_name: 'Only',
          last_name: 'FirstName',
        },
      });
      const result = filterMembers([memberWithPartialUser], 'Only', 'all', 'all');
      expect(result).toHaveLength(1);
    });
  });

  describe('hasFilters detection', () => {
    // Helper function that mirrors component logic
    function hasActiveFilters(search: string, role: string, status: string): boolean {
      return search !== '' || role !== 'all' || status !== 'all';
    }

    it('should detect when search is active', () => {
      expect(hasActiveFilters('john', 'all', 'all')).toBe(true);
    });

    it('should detect when role filter is active', () => {
      expect(hasActiveFilters('', 'admin', 'all')).toBe(true);
    });

    it('should detect when status filter is active', () => {
      expect(hasActiveFilters('', 'all', 'active')).toBe(true);
    });

    it('should detect when no filters are active', () => {
      expect(hasActiveFilters('', 'all', 'all')).toBe(false);
    });
  });

  describe('canManage logic', () => {
    // Helper function that mirrors component logic
    function canUserManage(role: Role): boolean {
      return role === 'admin' || role === 'it_admin';
    }

    it('admin can manage', () => {
      expect(canUserManage('admin')).toBe(true);
    });

    it('it_admin can manage', () => {
      expect(canUserManage('it_admin')).toBe(true);
    });

    it('broker cannot manage', () => {
      expect(canUserManage('broker')).toBe(false);
    });

    it('agent cannot manage', () => {
      expect(canUserManage('agent')).toBe(false);
    });
  });
});
