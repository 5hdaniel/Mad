import { test, expect } from '@playwright/test';

/**
 * Support Platform E2E Tests — Customer Portal (Broker Portal)
 *
 * Tests the public ticket submission form and customer-facing pages.
 * These run against the broker portal on localhost:3001.
 */

const BROKER_URL = 'http://localhost:3001';

test.describe('Customer Portal — Public Ticket Form', () => {
  test('loads the ticket submission form at /support/new', async ({ page }) => {
    await page.goto(`${BROKER_URL}/support/new`);

    // Should show the "Keepr. Support" branding (with period) and form heading
    await expect(page.getByText('Keepr. Support')).toBeVisible();
    await expect(page.getByText('Submit a Support Request')).toBeVisible();

    // Should show required form fields
    await expect(page.getByLabel(/Your Name/i)).toBeVisible();
    await expect(page.getByLabel(/Email Address/i)).toBeVisible();
    await expect(page.getByLabel(/Subject/i)).toBeVisible();
    await expect(page.getByLabel(/Description/i)).toBeVisible();
    await expect(page.getByLabel(/Category/i)).toBeVisible();
    await expect(page.getByLabel(/Priority/i)).toBeVisible();

    // Should show submit button
    await expect(page.getByRole('button', { name: /Submit Ticket/i })).toBeVisible();
  });

  test('shows validation when submitting empty form', async ({ page }) => {
    await page.goto(`${BROKER_URL}/support/new`);

    // Try to submit without filling anything
    await page.getByRole('button', { name: /Submit Ticket/i }).click();

    // HTML5 validation should prevent submission — name field should be required
    const nameInput = page.getByLabel(/Your Name/i);
    await expect(nameInput).toHaveAttribute('required', '');
  });

  test('category and priority fields appear before subject and description', async ({ page }) => {
    await page.goto(`${BROKER_URL}/support/new`);

    // Get the DOM position (bounding box top) of each field to verify order:
    // Category/Priority row should appear above Subject/Description
    const categoryTop = await page.getByLabel(/Category/i).boundingBox().then((b) => b?.y ?? 0);
    const priorityTop = await page.getByLabel(/Priority/i).boundingBox().then((b) => b?.y ?? 0);
    const subjectTop = await page.getByLabel(/Subject/i).boundingBox().then((b) => b?.y ?? 0);
    const descriptionTop = await page.getByLabel(/Description/i).boundingBox().then((b) => b?.y ?? 0);

    // Category and priority are in the same row, both above subject
    expect(categoryTop).toBeLessThan(subjectTop);
    expect(priorityTop).toBeLessThan(subjectTop);
    expect(subjectTop).toBeLessThan(descriptionTop);
  });

  test('can fill out and submit a ticket', async ({ page }) => {
    await page.goto(`${BROKER_URL}/support/new`);

    // Fill name/email first (top of form)
    await page.getByLabel(/Your Name/i).fill('QA Test User');
    await page.getByLabel(/Email Address/i).fill('qa-e2e@example.com');

    // Wait for categories to load, then select one (category/priority now appear before subject)
    const categorySelect = page.getByLabel(/Category/i);
    await expect(categorySelect.locator('option')).not.toHaveCount(1, { timeout: 5000 });
    const categoryOptions = await categorySelect.locator('option').count();
    if (categoryOptions > 1) {
      await categorySelect.selectOption({ index: 1 });
    }

    // Select priority
    await page.getByLabel(/Priority/i).selectOption('normal');

    // Fill subject/description (appear after category/priority)
    await page.getByLabel(/Subject/i).fill('E2E Test Ticket — Playwright');
    await page.getByLabel(/Description/i).fill('This is an automated test ticket submitted via Playwright E2E tests. Please ignore.');

    // Submit
    await page.getByRole('button', { name: /Submit Ticket/i }).click();

    // Should redirect to /support with success
    await page.waitForURL(`${BROKER_URL}/support?success=true`, { timeout: 10000 });
  });

  test('input text is visible (not white on white)', async ({ page }) => {
    await page.goto(`${BROKER_URL}/support/new`);

    const nameInput = page.getByLabel(/Your Name/i);
    await nameInput.fill('Visibility Test');

    // Check computed text color is dark (not white)
    const color = await nameInput.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    // Should be dark — rgb values should be low (not 255,255,255)
    expect(color).not.toBe('rgb(255, 255, 255)');
  });

  test('category dropdown shows the 7 categories', async ({ page }) => {
    await page.goto(`${BROKER_URL}/support/new`);

    const categorySelect = page.getByLabel(/Category/i);

    // Wait for categories to load (async fetch)
    await expect(categorySelect.locator('option')).not.toHaveCount(1, { timeout: 5000 });

    const options = await categorySelect.locator('option').allTextContents();

    // Should have placeholder + 7 categories
    expect(options.length).toBeGreaterThanOrEqual(8);
    expect(options).toContain('Authentication & Access');
    expect(options).toContain('Product Technical');
    expect(options).toContain('Billing & Subscription');
  });

  test('compliance disclaimer shows for Compliance Guidance category', async ({ page }) => {
    await page.goto(`${BROKER_URL}/support/new`);

    const categorySelect = page.getByLabel(/Category/i);

    // Wait for categories to load
    await expect(categorySelect.locator('option')).not.toHaveCount(1, { timeout: 5000 });

    // Select "Compliance Guidance"
    await categorySelect.selectOption({ label: 'Compliance Guidance' });

    // Disclaimer should appear
    await expect(page.getByText(/We provide product guidance/i)).toBeVisible();
    await expect(page.getByText(/We do not provide legal advice/i)).toBeVisible();
  });

  test('priority dropdown shows all 4 levels', async ({ page }) => {
    await page.goto(`${BROKER_URL}/support/new`);

    const prioritySelect = page.getByLabel(/Priority/i);
    const options = await prioritySelect.locator('option').allTextContents();

    expect(options).toContain('Low');
    expect(options).toContain('Normal');
    expect(options).toContain('High');
    expect(options).toContain('Urgent');
  });
});

test.describe('Customer Portal — Branding', () => {
  test('shows "Keepr." branding with period in header and footer', async ({ page }) => {
    await page.goto(`${BROKER_URL}/support/new`);

    // Header should show "Keepr. Support" (with period — not "Keepr Support")
    const header = page.locator('header');
    await expect(header.getByText('Keepr. Support')).toBeVisible();

    // Footer should show "Keepr. Compliance" branding
    const footer = page.locator('footer');
    await expect(footer.getByText(/Keepr\. Compliance/)).toBeVisible();
  });
});

test.describe('Customer Portal — Ticket List', () => {
  test('loads the support landing page at /support', async ({ page }) => {
    await page.goto(`${BROKER_URL}/support`);

    // Should show "Keepr. Support" branding (with period)
    await expect(page.getByText('Keepr. Support')).toBeVisible();
  });

  test('has a link to create a new ticket', async ({ page }) => {
    await page.goto(`${BROKER_URL}/support`);

    const newTicketLink = page.getByRole('link', { name: /New Ticket/i });
    await expect(newTicketLink).toBeVisible();
  });
});
