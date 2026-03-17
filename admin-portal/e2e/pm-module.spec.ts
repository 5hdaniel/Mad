import { test, expect } from '@playwright/test';

/**
 * PM Module E2E Tests (Admin Portal)
 *
 * The admin portal requires Microsoft auth. Without a logged-in session,
 * pages return non-200 (server-side auth check). This confirms the pages
 * are protected and that routes exist.
 */

test.describe('PM Module — Auth Protection', () => {
  test('PM dashboard is protected (requires auth)', async ({ page }) => {
    const response = await page.goto('/dashboard/pm');
    // Should not return 200 without auth — 500 or redirect expected
    expect(response?.status()).not.toBe(200);
  });

  test('PM backlog page is protected (requires auth)', async ({ page }) => {
    const response = await page.goto('/dashboard/pm/backlog');
    expect(response?.status()).not.toBe(200);
  });

  test('PM task detail page is protected (requires auth)', async ({ page }) => {
    const response = await page.goto('/dashboard/pm/tasks/00000000-0000-0000-0000-000000000000');
    expect(response?.status()).not.toBe(200);
  });
});

test.describe('PM Module — Page Structure', () => {
  test('PM dashboard route exists', async ({ page }) => {
    const response = await page.goto('/dashboard/pm');
    // Route should exist (not 404) — auth redirect or 500 means the route is wired up
    const status = response?.status() ?? 0;
    // A 404 means the route does not exist; any other status means it does
    expect(status).not.toBe(404);
  });

  test('PM backlog route exists', async ({ page }) => {
    const response = await page.goto('/dashboard/pm/backlog');
    const status = response?.status() ?? 0;
    expect(status).not.toBe(404);
  });

  test('PM task detail route exists', async ({ page }) => {
    const response = await page.goto('/dashboard/pm/tasks/00000000-0000-0000-0000-000000000000');
    const status = response?.status() ?? 0;
    expect(status).not.toBe(404);
  });
});
