/**
 * Extract Cookies — saves auth session from your running Chrome browser.
 *
 * Usage:
 *   1. Log into the admin portal at http://localhost:3002 in Chrome
 *   2. Run: npx tsx e2e/extract-cookies.ts
 *
 * This connects to your running Chrome via CDP and extracts
 * the Supabase auth cookies so Playwright can use them.
 */
import { chromium } from '@playwright/test';
import fs from 'fs';

const authFile = './e2e/.auth/session.json';

async function extractCookies() {
  console.log('Connecting to Chrome on port 9222...');
  console.log('');
  console.log('If this fails, restart Chrome with remote debugging:');
  console.log('  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
  console.log('');

  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const contexts = browser.contexts();

    if (contexts.length === 0) {
      console.error('No browser contexts found. Make sure Chrome is open.');
      process.exit(1);
    }

    // Find a page on localhost:3002
    let targetPage = null;
    for (const ctx of contexts) {
      for (const page of ctx.pages()) {
        if (page.url().includes('localhost:3002')) {
          targetPage = page;
          break;
        }
      }
    }

    if (!targetPage) {
      console.error('No tab found with localhost:3002. Open the admin portal first.');
      process.exit(1);
    }

    console.log('Found admin portal tab:', targetPage.url());

    // Save the storage state (cookies + localStorage)
    const context = targetPage.context();
    await context.storageState({ path: authFile });

    console.log('Session saved to', authFile);
    console.log('You can now run: npm run test:e2e');

    await browser.close();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('ECONNREFUSED')) {
      console.error('Could not connect to Chrome. Start Chrome with:');
      console.error('  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
    } else {
      console.error('Error:', message);
    }
    process.exit(1);
  }
}

extractCookies();
