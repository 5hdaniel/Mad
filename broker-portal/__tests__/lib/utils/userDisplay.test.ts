/**
 * Tests for User Display Utilities
 *
 * Tests for pure utility functions in broker-portal/lib/utils/userDisplay.ts
 * and type constants in broker-portal/lib/types/users.ts
 *
 * These are pure functions with no external dependencies, making them
 * easy to test without mocking.
 *
 * TASK-1814: Initial utilities
 */

// Direct relative imports to avoid path alias issues with Jest
import {
  formatUserDisplayName,
  getUserInitials,
  getAssignableRoles,
  canAssignRole,
  getProvisioningDescription,
} from '../../../lib/utils/userDisplay';

import {
  ADMIN_ROLES,
  ASSIGNABLE_ROLES_BY_ADMIN,
  ASSIGNABLE_ROLES_BY_IT_ADMIN,
  ROLE_LABELS,
  LICENSE_STATUS_LABELS,
  PROVISIONING_SOURCE_LABELS,
  type Role,
} from '../../../lib/types/users';

// ============================================================================
// formatUserDisplayName Tests
// ============================================================================

describe('formatUserDisplayName', () => {
  describe('with display_name', () => {
    it('should return display_name when available', () => {
      const user = { display_name: 'John Doe', first_name: 'Johnny', last_name: 'D' };
      expect(formatUserDisplayName(user)).toBe('John Doe');
    });

    it('should prefer display_name over first/last name', () => {
      const user = { display_name: 'JD', first_name: 'John', last_name: 'Doe' };
      expect(formatUserDisplayName(user)).toBe('JD');
    });
  });

  describe('with first_name and last_name', () => {
    it('should combine first and last name', () => {
      const user = { display_name: null, first_name: 'John', last_name: 'Doe' };
      expect(formatUserDisplayName(user)).toBe('John Doe');
    });

    it('should handle only first_name', () => {
      const user = { display_name: null, first_name: 'John', last_name: null };
      expect(formatUserDisplayName(user)).toBe('John');
    });

    it('should handle only last_name', () => {
      const user = { display_name: null, first_name: null, last_name: 'Doe' };
      expect(formatUserDisplayName(user)).toBe('Doe');
    });
  });

  describe('with fallback email', () => {
    it('should use fallback email when no name available', () => {
      const user = { display_name: null, first_name: null, last_name: null };
      expect(formatUserDisplayName(user, 'john@example.com')).toBe('john@example.com');
    });

    it('should use fallback email when user is null', () => {
      expect(formatUserDisplayName(null, 'john@example.com')).toBe('john@example.com');
    });
  });

  describe('edge cases', () => {
    it('should return "Unknown User" when no data available', () => {
      expect(formatUserDisplayName(null)).toBe('Unknown User');
    });

    it('should return "Unknown User" when all fields are null', () => {
      const user = { display_name: null, first_name: null, last_name: null };
      expect(formatUserDisplayName(user)).toBe('Unknown User');
    });

    it('should handle empty strings as falsy', () => {
      const user = { display_name: '', first_name: '', last_name: '' };
      expect(formatUserDisplayName(user, 'fallback@test.com')).toBe('fallback@test.com');
    });
  });
});

// ============================================================================
// getUserInitials Tests
// ============================================================================

describe('getUserInitials', () => {
  describe('with display_name', () => {
    it('should return first and last initials from multi-word display_name', () => {
      const user = { display_name: 'John Doe', first_name: null, last_name: null };
      expect(getUserInitials(user)).toBe('JD');
    });

    it('should handle three-word names', () => {
      const user = { display_name: 'John Michael Doe', first_name: null, last_name: null };
      expect(getUserInitials(user)).toBe('JD');
    });

    it('should return first two chars for single-word display_name', () => {
      const user = { display_name: 'John', first_name: null, last_name: null };
      expect(getUserInitials(user)).toBe('JO');
    });

    it('should uppercase the initials', () => {
      const user = { display_name: 'john doe', first_name: null, last_name: null };
      expect(getUserInitials(user)).toBe('JD');
    });
  });

  describe('with first_name and last_name', () => {
    it('should use first_name and last_name when no display_name', () => {
      const user = { display_name: null, first_name: 'John', last_name: 'Doe' };
      expect(getUserInitials(user)).toBe('JD');
    });

    it('should use first two chars of first_name when no last_name', () => {
      const user = { display_name: null, first_name: 'John', last_name: null };
      expect(getUserInitials(user)).toBe('JO');
    });
  });

  describe('with fallback email', () => {
    it('should use first two chars of email when no name', () => {
      const user = { display_name: null, first_name: null, last_name: null };
      expect(getUserInitials(user, 'john@example.com')).toBe('JO');
    });

    it('should use email when user is null', () => {
      expect(getUserInitials(null, 'alice@test.com')).toBe('AL');
    });
  });

  describe('edge cases', () => {
    it('should return ?? when no data available', () => {
      expect(getUserInitials(null)).toBe('??');
    });

    it('should handle short names', () => {
      const user = { display_name: 'A B', first_name: null, last_name: null };
      expect(getUserInitials(user)).toBe('AB');
    });
  });
});

// ============================================================================
// getAssignableRoles Tests
// ============================================================================

describe('getAssignableRoles', () => {
  it('should return all roles for it_admin', () => {
    expect(getAssignableRoles('it_admin')).toEqual(['agent', 'broker', 'admin', 'it_admin']);
  });

  it('should return all roles except it_admin for admin', () => {
    expect(getAssignableRoles('admin')).toEqual(['agent', 'broker', 'admin']);
  });

  it('should return empty array for broker', () => {
    expect(getAssignableRoles('broker')).toEqual([]);
  });

  it('should return empty array for agent', () => {
    expect(getAssignableRoles('agent')).toEqual([]);
  });
});

// ============================================================================
// canAssignRole Tests
// ============================================================================

describe('canAssignRole', () => {
  describe('it_admin assigner', () => {
    it('can assign agent role', () => {
      expect(canAssignRole('it_admin', 'agent')).toBe(true);
    });

    it('can assign broker role', () => {
      expect(canAssignRole('it_admin', 'broker')).toBe(true);
    });

    it('can assign admin role', () => {
      expect(canAssignRole('it_admin', 'admin')).toBe(true);
    });

    it('can assign it_admin role', () => {
      expect(canAssignRole('it_admin', 'it_admin')).toBe(true);
    });
  });

  describe('admin assigner', () => {
    it('can assign agent role', () => {
      expect(canAssignRole('admin', 'agent')).toBe(true);
    });

    it('can assign broker role', () => {
      expect(canAssignRole('admin', 'broker')).toBe(true);
    });

    it('can assign admin role', () => {
      expect(canAssignRole('admin', 'admin')).toBe(true);
    });

    it('cannot assign it_admin role', () => {
      expect(canAssignRole('admin', 'it_admin')).toBe(false);
    });
  });

  describe('non-admin assigners', () => {
    const nonAdminRoles: Role[] = ['agent', 'broker'];

    nonAdminRoles.forEach((role) => {
      it(`${role} cannot assign any role`, () => {
        expect(canAssignRole(role, 'agent')).toBe(false);
        expect(canAssignRole(role, 'broker')).toBe(false);
        expect(canAssignRole(role, 'admin')).toBe(false);
        expect(canAssignRole(role, 'it_admin')).toBe(false);
      });
    });
  });
});

// ============================================================================
// getProvisioningDescription Tests
// ============================================================================

describe('getProvisioningDescription', () => {
  it('should return correct description for manual', () => {
    expect(getProvisioningDescription('manual')).toBe('Added manually');
  });

  it('should return correct description for scim', () => {
    expect(getProvisioningDescription('scim')).toBe('Provisioned via SCIM');
  });

  it('should return correct description for jit', () => {
    expect(getProvisioningDescription('jit')).toBe('Just-in-time provisioned');
  });

  it('should return correct description for invite', () => {
    expect(getProvisioningDescription('invite')).toBe('Joined via invitation');
  });

  it('should return Unknown for null', () => {
    expect(getProvisioningDescription(null)).toBe('Unknown');
  });

  it('should return Unknown for invalid source', () => {
    expect(getProvisioningDescription('invalid')).toBe('Unknown');
  });
});

// ============================================================================
// Type Constants Tests
// ============================================================================

describe('Type Constants', () => {
  describe('ADMIN_ROLES', () => {
    it('should include admin and it_admin', () => {
      expect(ADMIN_ROLES).toContain('admin');
      expect(ADMIN_ROLES).toContain('it_admin');
    });

    it('should not include non-admin roles', () => {
      expect(ADMIN_ROLES).not.toContain('agent');
      expect(ADMIN_ROLES).not.toContain('broker');
    });
  });

  describe('ASSIGNABLE_ROLES_BY_ADMIN', () => {
    it('should include agent, broker, admin', () => {
      expect(ASSIGNABLE_ROLES_BY_ADMIN).toEqual(['agent', 'broker', 'admin']);
    });
  });

  describe('ASSIGNABLE_ROLES_BY_IT_ADMIN', () => {
    it('should include all roles', () => {
      expect(ASSIGNABLE_ROLES_BY_IT_ADMIN).toEqual(['agent', 'broker', 'admin', 'it_admin']);
    });
  });

  describe('ROLE_LABELS', () => {
    it('should have human-readable labels for all roles', () => {
      expect(ROLE_LABELS.agent).toBe('Agent');
      expect(ROLE_LABELS.broker).toBe('Broker');
      expect(ROLE_LABELS.admin).toBe('Admin');
      expect(ROLE_LABELS.it_admin).toBe('IT Admin');
    });
  });

  describe('LICENSE_STATUS_LABELS', () => {
    it('should have human-readable labels for all statuses', () => {
      expect(LICENSE_STATUS_LABELS.pending).toBe('Pending');
      expect(LICENSE_STATUS_LABELS.active).toBe('Active');
      expect(LICENSE_STATUS_LABELS.suspended).toBe('Suspended');
      expect(LICENSE_STATUS_LABELS.expired).toBe('Expired');
    });
  });

  describe('PROVISIONING_SOURCE_LABELS', () => {
    it('should have human-readable labels for all sources', () => {
      expect(PROVISIONING_SOURCE_LABELS.manual).toBe('Manual');
      expect(PROVISIONING_SOURCE_LABELS.scim).toBe('SCIM');
      expect(PROVISIONING_SOURCE_LABELS.jit).toBe('Just-in-Time');
      expect(PROVISIONING_SOURCE_LABELS.invite).toBe('Invited');
    });
  });
});
