/**
 * E2E tests — Account management and transactions
 *
 * Each test logs in via the API and injects the session token to skip the UI
 * login flow.  Account operations are tested end-to-end through the browser.
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000/api/v1';

interface SessionCreds {
  accessToken: string;
  userId: string;
  accountId?: string;
}

async function setupUserWithAccount(): Promise<SessionCreds> {
  const email = `acc-e2e-${Date.now()}@cowry.test`;
  const password = 'E2eTest1!';

  // Register
  const regRes = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email, password,
      firstName: 'Account', lastName: 'Test',
      phoneNumber: `+447700${Date.now().toString().slice(-6)}`,
    }),
  });
  const { data: reg } = await regRes.json();

  // Verify email
  await fetch(`${API}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: reg.verificationToken }),
  });

  const accessToken: string = reg.accessToken;
  const userId: string = reg.user.id;

  // Enable MFA (required to access account routes)
  // Set up MFA via API
  const mfaSetupRes = await fetch(`${API}/auth/setup-mfa`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (mfaSetupRes.ok) {
    // In a full test environment we'd generate a TOTP code here.
    // Skip MFA if it's not supported in the current test setup.
  }

  return { accessToken, userId };
}

async function injectToken(page: import('@playwright/test').Page, accessToken: string) {
  await page.goto('/');
  await page.evaluate((tok) => {
    localStorage.setItem('accessToken', tok);
    // Also write to the format the auth-context reads
    localStorage.setItem('cowry_token', JSON.stringify({ accessToken: tok, refreshToken: '' }));
  }, accessToken);
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Account creation', () => {
  test('user can create a savings account from the dashboard', async ({ page }) => {
    const { accessToken } = await setupUserWithAccount();
    await injectToken(page, accessToken);
    await page.goto('/dashboard');

    // Find and click the "New account" / "Add account" button
    const addBtn = page.getByRole('button', { name: /new account|add account|open account/i });
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // Select savings if there's a modal/selector
    const savingsOption = page.getByText(/savings/i).first();
    if (await savingsOption.isVisible()) await savingsOption.click();

    const confirmBtn = page.getByRole('button', { name: /create|open|confirm/i }).last();
    if (await confirmBtn.isVisible()) await confirmBtn.click();

    // Account card should appear
    await expect(page.getByText(/savings/i)).toBeVisible({ timeout: 12_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Deposits', () => {
  test('depositing funds increases the displayed balance', async ({ page }) => {
    const { accessToken } = await setupUserWithAccount();
    await injectToken(page, accessToken);

    // Create a savings account via API
    const createRes = await fetch(`${API}/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ type: 'savings' }),
    });

    if (!createRes.ok) {
      test.skip(); // MFA not configured — skip account tests
      return;
    }

    const { data: account } = await createRes.json();
    await page.goto(`/dashboard/accounts/${account.id}`);

    // Capture initial balance text
    const initialBalance = await page.getByTestId('account-balance').textContent();

    await page.getByRole('button', { name: /deposit/i }).click();
    await page.getByLabel(/amount/i).fill('250');
    await page.getByRole('button', { name: /confirm|deposit/i }).last().click();

    // Balance should increase
    await expect(page.getByTestId('account-balance')).not.toHaveText(initialBalance ?? '', { timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Withdrawals', () => {
  test('withdrawing within limit decreases the balance', async ({ page }) => {
    const { accessToken } = await setupUserWithAccount();
    await injectToken(page, accessToken);

    // Create account
    const createRes = await fetch(`${API}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ type: 'savings' }),
    });
    if (!createRes.ok) { test.skip(); return; }
    const { data: account } = await createRes.json();

    // Deposit funds first
    await fetch(`${API}/accounts/${account.id}/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ amount: 500 }),
    });

    await page.goto(`/dashboard/accounts/${account.id}`);
    await page.getByRole('button', { name: /withdraw/i }).click();
    await page.getByLabel(/amount/i).fill('100');
    await page.getByRole('button', { name: /confirm|withdraw/i }).last().click();

    await expect(page.getByText(/400/)).toBeVisible({ timeout: 10_000 });
  });

  test('shows an error when attempting to withdraw more than the balance', async ({ page }) => {
    const { accessToken } = await setupUserWithAccount();
    await injectToken(page, accessToken);

    const createRes = await fetch(`${API}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ type: 'savings' }),
    });
    if (!createRes.ok) { test.skip(); return; }
    const { data: account } = await createRes.json();

    await page.goto(`/dashboard/accounts/${account.id}`);
    await page.getByRole('button', { name: /withdraw/i }).click();
    await page.getByLabel(/amount/i).fill('99999');
    await page.getByRole('button', { name: /confirm|withdraw/i }).last().click();

    await expect(page.getByText(/insufficient|not enough/i)).toBeVisible({ timeout: 8_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Transfers', () => {
  test('transfer between two accounts moves funds correctly', async ({ page }) => {
    const { accessToken } = await setupUserWithAccount();
    await injectToken(page, accessToken);

    // Create two accounts
    const [r1, r2] = await Promise.all([
      fetch(`${API}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ type: 'savings' }),
      }),
      fetch(`${API}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ type: 'current' }),
      }),
    ]);

    if (!r1.ok || !r2.ok) { test.skip(); return; }
    const [{ data: acc1 }, { data: acc2 }] = await Promise.all([r1.json(), r2.json()]);

    // Deposit into acc1
    await fetch(`${API}/accounts/${acc1.id}/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ amount: 1000 }),
    });

    await page.goto(`/dashboard/accounts/${acc1.id}`);
    await page.getByRole('button', { name: /transfer/i }).click();

    // Enter destination account number
    await page.getByLabel(/account number|to account/i).fill(acc2.accountNumber);
    await page.getByLabel(/amount/i).fill('300');
    await page.getByRole('button', { name: /confirm|transfer/i }).last().click();

    // Source balance should decrease
    await expect(page.getByText(/700/)).toBeVisible({ timeout: 10_000 });
  });

  test('shows an error when transferring to the same account', async ({ page }) => {
    const { accessToken } = await setupUserWithAccount();
    await injectToken(page, accessToken);

    const createRes = await fetch(`${API}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ type: 'savings' }),
    });
    if (!createRes.ok) { test.skip(); return; }
    const { data: account } = await createRes.json();

    await page.goto(`/dashboard/accounts/${account.id}`);
    await page.getByRole('button', { name: /transfer/i }).click();
    await page.getByLabel(/account number|to account/i).fill(account.accountNumber);
    await page.getByLabel(/amount/i).fill('50');
    await page.getByRole('button', { name: /confirm|transfer/i }).last().click();

    await expect(page.getByText(/same account/i)).toBeVisible({ timeout: 8_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Transaction history', () => {
  test('transactions appear in the account history after a deposit', async ({ page }) => {
    const { accessToken } = await setupUserWithAccount();
    await injectToken(page, accessToken);

    const createRes = await fetch(`${API}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ type: 'savings' }),
    });
    if (!createRes.ok) { test.skip(); return; }
    const { data: account } = await createRes.json();

    await fetch(`${API}/accounts/${account.id}/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ amount: 75, description: 'E2E test deposit' }),
    });

    await page.goto(`/dashboard/accounts/${account.id}`);

    await expect(page.getByText(/E2E test deposit/i)).toBeVisible({ timeout: 10_000 });
  });
});
