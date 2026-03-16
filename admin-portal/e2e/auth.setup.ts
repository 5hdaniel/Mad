import { test as setup } from '@playwright/test';
import fs from 'fs';

const authFile = './e2e/.auth/session.json';

/**
 * Auth Setup — reuses a saved session if available.
 *
 * Supabase PKCE OAuth flow doesn't work in Playwright browsers (BACKLOG item exists).
 * For now, save cookies manually via: npm run test:e2e:save-cookies
 * (requires Chrome launched with --remote-debugging-port=9222)
 */
setup('authenticate via SSO', async () => {
  if (fs.existsSync(authFile)) {
    const stats = fs.statSync(authFile);
    const ageMs = Date.now() - stats.mtimeMs;
    const oneHour = 60 * 60 * 1000;
    if (ageMs < oneHour) {
      console.log('Reusing saved auth session (< 1 hour old)');
      return;
    }
    console.log('Auth session expired (> 1 hour old)');
  }

  console.log('No valid auth session. Authenticated tests will be skipped.');
  console.log('To create a session: npm run test:e2e:save-cookies');

  // Write an empty session so tests don't crash — they'll just see unauthenticated state
  fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
});
