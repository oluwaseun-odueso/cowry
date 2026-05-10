/**
 * E2E tests — Authentication flows
 *
 * Covers: register → verify → login, wrong password, account lockout,
 * forgot-password reset, and the MFA setup + login flow.
 *
 * Each test creates its own isolated user via the API to avoid shared state.
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000/api/v1';

async function createAndVerifyUser(suffix: string) {
  const email = `auth-e2e-${suffix}-${Date.now()}@cowry.test`;
  const password = 'E2eTest1!';

  const regRes = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email, password,
      firstName: 'Auth', lastName: 'Test',
      phoneNumber: `+447700${Date.now().toString().slice(-6)}`,
    }),
  });
  const { data: regData } = await regRes.json();

  // Verify email
  await fetch(`${API}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: regData.verificationToken }),
  });

  return { email, password, userId: regData.user.id, accessToken: regData.accessToken };
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Registration', () => {
  test('user can register with valid details and lands on verify-email page', async ({ page }) => {
    const email = `reg-${Date.now()}@cowry.test`;

    await page.goto('/register');
    await page.getByLabel(/first name/i).fill('Alice');
    await page.getByLabel(/last name/i).fill('Smith');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/phone/i).fill('+447700900001');
    await page.getByLabel(/^password$/i).fill('E2eTest1!');
    await page.getByLabel(/confirm password/i).fill('E2eTest1!');
    await page.getByRole('button', { name: /create account|sign up|register/i }).click();

    await expect(page).toHaveURL(/verify-email/, { timeout: 10_000 });
  });

  test('shows validation error for a weak password', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel(/^password$/i).fill('weak');
    await page.getByRole('button', { name: /create account|sign up|register/i }).click();

    await expect(
      page.getByText(/password must be at least/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('shows an error when email is already taken', async ({ page }) => {
    const { email } = await createAndVerifyUser('dup');

    await page.goto('/register');
    await page.getByLabel(/first name/i).fill('Bob');
    await page.getByLabel(/last name/i).fill('Jones');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/phone/i).fill('+447700900002');
    await page.getByLabel(/^password$/i).fill('E2eTest1!');
    await page.getByLabel(/confirm password/i).fill('E2eTest1!');
    await page.getByRole('button', { name: /create account|sign up|register/i }).click();

    await expect(page.getByText(/already exists|already registered/i)).toBeVisible({ timeout: 8_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login', () => {
  test('verified user can log in and reach the dashboard', async ({ page }) => {
    const { email, password } = await createAndVerifyUser('login');

    await page.goto('/login');
    await page.getByPlaceholder(/you@example.com/i).fill(email);
    await page.getByPlaceholder(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Lands on dashboard or MFA setup
    await expect(page).toHaveURL(/dashboard|setup-mfa/, { timeout: 12_000 });
  });

  test('displays an error for wrong password', async ({ page }) => {
    const { email } = await createAndVerifyUser('wrong-pw');

    await page.goto('/login');
    await page.getByPlaceholder(/you@example.com/i).fill(email);
    await page.getByPlaceholder(/password/i).fill('WrongPass1!');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 8_000 });
  });

  test('shows lockout message after 5 consecutive wrong passwords', async ({ page }) => {
    const { email } = await createAndVerifyUser('lockout');

    await page.goto('/login');
    for (let i = 0; i < 5; i++) {
      await page.getByPlaceholder(/you@example.com/i).fill(email);
      await page.getByPlaceholder(/password/i).fill('WrongPass1!');
      await page.getByRole('button', { name: /sign in/i }).click();
      // Brief wait between attempts
      await page.waitForTimeout(300);
    }

    await expect(page.getByText(/locked|too many/i)).toBeVisible({ timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Forgot password', () => {
  test('submitting any email always shows a success message (anti-enumeration)', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel(/email/i).fill('nobody@nowhere.com');
    await page.getByRole('button', { name: /send|reset/i }).click();

    await expect(
      page.getByText(/if an account exists|check your email|email sent/i),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('user can reset their password via the reset link', async ({ page }) => {
    const { email } = await createAndVerifyUser('reset');
    const newPassword = 'NewE2ePass1!';

    // Request a reset token via API
    const res = await fetch(`${API}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const { data } = await res.json();
    const token: string = data?.token ?? data?.resetToken;

    if (!token) test.skip(); // email service not configured in test env

    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel(/^new password$/i).fill(newPassword);
    await page.getByLabel(/confirm/i).fill(newPassword);
    await page.getByRole('button', { name: /reset/i }).click();

    await expect(page).toHaveURL(/login/, { timeout: 10_000 });

    // Verify new password works
    await page.getByPlaceholder(/you@example.com/i).fill(email);
    await page.getByPlaceholder(/password/i).fill(newPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard|setup-mfa/, { timeout: 12_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('MFA setup and login', () => {
  test('user is prompted to set up MFA after first login', async ({ page }) => {
    const { email, password } = await createAndVerifyUser('mfa-setup');

    await page.goto('/login');
    await page.getByPlaceholder(/you@example.com/i).fill(email);
    await page.getByPlaceholder(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should land on setup-mfa if MFA is not yet configured
    await expect(page).toHaveURL(/setup-mfa/, { timeout: 12_000 });
    await expect(page.getByText(/authenticator/i)).toBeVisible();
  });
});
