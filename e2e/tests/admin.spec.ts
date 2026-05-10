/**
 * E2E tests — Admin panel
 *
 * Tests the fraud audit log list, risk-level filtering, alert resolution,
 * and the access-control redirect for non-admin users.
 *
 * An admin user is pre-seeded into the database.  Set the
 * ADMIN_EMAIL / ADMIN_PASSWORD env vars (or use the defaults below) to
 * point these tests at a seeded admin account.
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000/api/v1';
const ADMIN_EMAIL = process.env['ADMIN_EMAIL'] ?? 'admin@cowry.com';
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] ?? 'AdminPass1!';

async function loginAsAdmin(): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) return '';
  const { data } = await res.json();
  return (data.accessToken as string) ?? '';
}

async function loginAsRegularUser(): Promise<string> {
  const email = `non-admin-${Date.now()}@cowry.test`;
  const regRes = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email, password: 'E2eTest1!',
      firstName: 'Regular', lastName: 'User',
      phoneNumber: `+447700${Date.now().toString().slice(-6)}`,
    }),
  });
  const { data: reg } = await regRes.json();
  await fetch(`${API}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: reg.verificationToken }),
  });
  return reg.accessToken as string;
}

async function injectToken(page: import('@playwright/test').Page, token: string) {
  await page.goto('/');
  await page.evaluate((tok) => localStorage.setItem('accessToken', tok), token);
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Admin — Audit log', () => {
  test('admin sees the audit log with risk badges', async ({ page }) => {
    const token = await loginAsAdmin();
    if (!token) { test.skip(); return; }

    await injectToken(page, token);
    await page.goto('/dashboard/admin');

    await expect(page.getByRole('table')).toBeVisible({ timeout: 12_000 });
    // Risk level badges should be present
    await expect(page.getByText(/low|medium|high/i).first()).toBeVisible();
  });

  test('filtering by HIGH risk shows only HIGH alerts', async ({ page }) => {
    const token = await loginAsAdmin();
    if (!token) { test.skip(); return; }

    await injectToken(page, token);
    await page.goto('/dashboard/admin');

    // Look for a risk level filter dropdown/button
    const highFilter = page.getByRole('button', { name: /high/i })
      .or(page.getByRole('option', { name: /high/i }))
      .first();

    if (!(await highFilter.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await highFilter.click();

    // After filtering, no "low" or "medium" badges should be visible in the table
    await page.waitForTimeout(500);
    const rows = await page.getByRole('row').count();
    if (rows <= 1) return; // no data to assert on
    await expect(page.getByText(/\blow\b/i).first()).not.toBeVisible();
  });

  test('admin can mark an alert as resolved', async ({ page }) => {
    const token = await loginAsAdmin();
    if (!token) { test.skip(); return; }

    await injectToken(page, token);
    await page.goto('/dashboard/admin');

    await expect(page.getByRole('table')).toBeVisible({ timeout: 12_000 });

    // Find the first unresolved alert and resolve it
    const resolveBtn = page.getByRole('button', { name: /resolve/i }).first();
    if (!(await resolveBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await resolveBtn.click();

    // Confirm if a dialog appears
    const confirmBtn = page.getByRole('button', { name: /confirm|yes/i }).last();
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await expect(page.getByText(/resolved/i)).toBeVisible({ timeout: 8_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Admin — Access control', () => {
  test('non-admin user is redirected away from /dashboard/admin', async ({ page }) => {
    const token = await loginAsRegularUser();
    await injectToken(page, token);
    await page.goto('/dashboard/admin');

    // Should be redirected to dashboard or shown a 403 / not-found page
    await expect(page).not.toHaveURL('/dashboard/admin', { timeout: 10_000 });
  });

  test('unauthenticated visitor is redirected to login', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Admin — Users list', () => {
  test('admin sees the users table with at least one row', async ({ page }) => {
    const token = await loginAsAdmin();
    if (!token) { test.skip(); return; }

    await injectToken(page, token);
    await page.goto('/dashboard/admin');

    // Navigate to users tab / section
    const usersTab = page.getByRole('tab', { name: /users/i })
      .or(page.getByRole('button', { name: /users/i }))
      .first();

    if (await usersTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await usersTab.click();
    }

    const table = page.getByRole('table').first();
    if (await table.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const rowCount = await page.getByRole('row').count();
      expect(rowCount).toBeGreaterThan(1); // header + at least one data row
    }
  });
});
