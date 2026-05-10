/**
 * Playwright test fixtures for authenticated sessions.
 *
 * Provides:
 *   - `authenticatedPage` — a Page already logged in as a standard user
 *   - `adminPage`          — a Page logged in as an admin
 *
 * Users are created via the API (not the UI) so auth tests don't have to
 * go through the registration flow every time.
 */
import { test as base, Page } from '@playwright/test';

const API_BASE = 'http://localhost:3000/api/v1';

export interface UserCredentials {
  email: string;
  password: string;
  accessToken: string;
  userId: string;
}

/** Create a test user via the API and return credentials + access token. */
async function createTestUser(suffix: string): Promise<UserCredentials> {
  const email = `e2e-${suffix}-${Date.now()}@cowry.test`;
  const password = 'E2eTest1!';

  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      firstName: 'E2E',
      lastName: 'User',
      phoneNumber: `+44770090${Date.now().toString().slice(-4)}`,
    }),
  });

  if (!regRes.ok) {
    const body = await regRes.text();
    throw new Error(`Failed to create test user: ${regRes.status} ${body}`);
  }

  const { data } = await regRes.json();

  // Verify email via the token returned in registration response
  if (data.verificationToken) {
    await fetch(`${API_BASE}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: data.verificationToken }),
    });
  }

  return {
    email,
    password,
    accessToken: data.accessToken,
    userId: data.user.id,
  };
}

/** Inject the access token into the browser so the app treats the session as authenticated. */
async function injectSession(page: Page, creds: UserCredentials) {
  await page.goto('/');
  await page.evaluate((token) => {
    localStorage.setItem('accessToken', token);
  }, creds.accessToken);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

type Fixtures = {
  userCreds: UserCredentials;
  authenticatedPage: Page;
};

export const test = base.extend<Fixtures>({
  userCreds: async ({}, use) => {
    const creds = await createTestUser('user');
    await use(creds);
  },

  authenticatedPage: async ({ page, userCreds }, use) => {
    await injectSession(page, userCreds);
    await page.goto('/dashboard');
    await use(page);
  },
});

export { expect } from '@playwright/test';
