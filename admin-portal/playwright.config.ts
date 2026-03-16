import { defineConfig, devices } from '@playwright/test';

const authFile = './e2e/.auth/session.json';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Setup: log in manually once, save session
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Tests that don't need auth (login page, public pages)
    {
      name: 'no-auth',
      testMatch: /login\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Tests that need an authenticated session
    {
      name: 'authenticated',
      testIgnore: [/login\.spec\.ts/, /auth\.setup\.ts/],
      dependencies: ['auth-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
    },
  ],
  // Dev servers started externally — don't try to start them here
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3002',
  //   reuseExistingServer: true,
  //   timeout: 30000,
  // },
});
