/**
 * Permissions constants tests
 * TASK-2254: Tests for admin-portal RBAC permission constants
 */

import { describe, it, expect } from 'vitest';
import { PERMISSIONS, PERMISSION_CATEGORIES } from '../permissions';
import type { PermissionKey } from '../permissions';

describe('PERMISSIONS', () => {
  it('should define all expected dashboard permissions', () => {
    expect(PERMISSIONS.DASHBOARD_VIEW).toBe('dashboard.view');
  });

  it('should define all expected user permissions', () => {
    expect(PERMISSIONS.USERS_VIEW).toBe('users.view');
    expect(PERMISSIONS.USERS_SEARCH).toBe('users.search');
    expect(PERMISSIONS.USERS_DETAIL).toBe('users.detail');
    expect(PERMISSIONS.USERS_EDIT).toBe('users.edit');
    expect(PERMISSIONS.USERS_SUSPEND).toBe('users.suspend');
    expect(PERMISSIONS.USERS_IMPERSONATE).toBe('users.impersonate');
  });

  it('should define support permissions', () => {
    expect(PERMISSIONS.SUPPORT_VIEW).toBe('support.view');
    expect(PERMISSIONS.SUPPORT_RESPOND).toBe('support.respond');
    expect(PERMISSIONS.SUPPORT_ASSIGN).toBe('support.assign');
    expect(PERMISSIONS.SUPPORT_MANAGE).toBe('support.manage');
    expect(PERMISSIONS.SUPPORT_ADMIN).toBe('support.admin');
  });

  it('should define PM permissions', () => {
    expect(PERMISSIONS.PM_VIEW).toBe('pm.view');
    expect(PERMISSIONS.PM_EDIT).toBe('pm.edit');
    expect(PERMISSIONS.PM_ASSIGN).toBe('pm.assign');
    expect(PERMISSIONS.PM_MANAGE).toBe('pm.manage');
    expect(PERMISSIONS.PM_ADMIN).toBe('pm.admin');
  });

  it('should have all values in category.key format', () => {
    const values = Object.values(PERMISSIONS);
    for (const value of values) {
      expect(value).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it('should have unique permission values', () => {
    const values = Object.values(PERMISSIONS);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

describe('PERMISSION_CATEGORIES', () => {
  it('should contain expected categories', () => {
    const keys = PERMISSION_CATEGORIES.map((c) => c.key);
    expect(keys).toContain('dashboard');
    expect(keys).toContain('users');
    expect(keys).toContain('support');
    expect(keys).toContain('pm');
  });

  it('should have both key and label for each category', () => {
    for (const category of PERMISSION_CATEGORIES) {
      expect(category.key).toBeTruthy();
      expect(category.label).toBeTruthy();
    }
  });

  it('should have unique category keys', () => {
    const keys = PERMISSION_CATEGORIES.map((c) => c.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });
});
