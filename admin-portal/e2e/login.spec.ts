import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test('shows login page with correct elements', async ({ page }) => {
    await page.goto('/login');

    // Verify header
    await expect(page.getByRole('heading', { name: 'Keepr.' })).toBeVisible();
    await expect(page.getByText('Admin Portal')).toBeVisible();
    await expect(page.getByText('Sign in to access the administration dashboard')).toBeVisible();

    // Verify Microsoft login button
    await expect(page.getByRole('button', { name: 'Sign in with Microsoft' })).toBeVisible();

    // Verify footer text
    await expect(page.getByText('Only authorized internal users can access this portal.')).toBeVisible();
  });

  test('root page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows error message when auth fails', async ({ page }) => {
    await page.goto('/login?error=auth_failed');
    await expect(page.getByText('Authentication failed. Please try again.')).toBeVisible();
  });

  test('shows not authorized error', async ({ page }) => {
    await page.goto('/login?error=not_authorized');
    await expect(page.getByText('Your account does not have admin access')).toBeVisible();
  });
});
