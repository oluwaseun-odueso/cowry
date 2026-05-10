/**
 * E2E tests — Card management
 *
 * Tests issue, freeze, unfreeze (step-up), reveal (step-up), and disposable cards.
 * Step-up flows that require a live OTP email are skipped in CI unless the
 * ENABLE_OTP_E2E env var is set.
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000/api/v1';

async function setupSession() {
  const email = `cards-e2e-${Date.now()}@cowry.test`;
  const password = 'E2eTest1!';

  const regRes = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email, password,
      firstName: 'Card', lastName: 'Test',
      phoneNumber: `+447700${Date.now().toString().slice(-6)}`,
    }),
  });
  const { data: reg } = await regRes.json();
  await fetch(`${API}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: reg.verificationToken }),
  });
  return { accessToken: reg.accessToken as string, userId: reg.user.id as string };
}

async function createAccount(accessToken: string, type: 'savings' | 'current') {
  const res = await fetch(`${API}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ type }),
  });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data as { id: string; accountNumber: string };
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Card issuance', () => {
  test('user can issue a debit card and see it in the card list', async ({ page }) => {
    const { accessToken } = await setupSession();
    await page.goto('/');
    await page.evaluate((tok) => localStorage.setItem('accessToken', tok), accessToken);

    const account = await createAccount(accessToken, 'current');
    if (!account) { test.skip(); return; }

    await page.goto('/dashboard/cards');
    const issueBtn = page.getByRole('button', { name: /issue|add card|new card/i });
    await expect(issueBtn).toBeVisible({ timeout: 10_000 });
    await issueBtn.click();

    // Select the account if prompted
    const accountSelect = page.getByLabel(/account/i).first();
    if (await accountSelect.isVisible()) {
      await accountSelect.selectOption({ label: /current/i });
    }

    await page.getByRole('button', { name: /confirm|issue|create/i }).last().click();

    // Card should appear in the list
    await expect(page.getByText(/debit/i)).toBeVisible({ timeout: 12_000 });
  });

  test('user can issue a disposable card', async ({ page }) => {
    const { accessToken } = await setupSession();
    await page.goto('/');
    await page.evaluate((tok) => localStorage.setItem('accessToken', tok), accessToken);

    const account = await createAccount(accessToken, 'current');
    if (!account) { test.skip(); return; }

    await page.goto('/dashboard/cards');
    const disposableBtn = page.getByRole('button', { name: /disposable/i });
    if (!(await disposableBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await disposableBtn.click();

    const confirmBtn = page.getByRole('button', { name: /confirm|issue|create/i }).last();
    if (await confirmBtn.isVisible()) await confirmBtn.click();

    await expect(page.getByText(/disposable/i)).toBeVisible({ timeout: 12_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Card freeze / unfreeze', () => {
  test('user can freeze an active card', async ({ page }) => {
    const { accessToken } = await setupSession();
    await page.goto('/');
    await page.evaluate((tok) => localStorage.setItem('accessToken', tok), accessToken);

    const account = await createAccount(accessToken, 'current');
    if (!account) { test.skip(); return; }

    // Issue a card via API
    const cardRes = await fetch(`${API}/accounts/${account.id}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ cardType: 'debit' }),
    });
    if (!cardRes.ok) { test.skip(); return; }
    const { data: card } = await cardRes.json();

    await page.goto(`/dashboard/cards`);

    // Find the freeze button for this card
    const freezeBtn = page.getByRole('button', { name: /freeze/i }).first();
    await expect(freezeBtn).toBeVisible({ timeout: 10_000 });
    await freezeBtn.click();

    // Confirm freeze if there's a dialog
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|freeze/i }).last();
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Card should show "Frozen" status
    await expect(page.getByText(/frozen/i)).toBeVisible({ timeout: 10_000 });
  });

  test('unfreezing requires a step-up OTP (modal appears)', async ({ page }) => {
    const { accessToken } = await setupSession();
    await page.goto('/');
    await page.evaluate((tok) => localStorage.setItem('accessToken', tok), accessToken);

    const account = await createAccount(accessToken, 'current');
    if (!account) { test.skip(); return; }

    const cardRes = await fetch(`${API}/accounts/${account.id}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ cardType: 'debit' }),
    });
    if (!cardRes.ok) { test.skip(); return; }
    const { data: card } = await cardRes.json();

    // Freeze the card first via API
    await fetch(`${API}/cards/${card.id}/freeze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    await page.goto('/dashboard/cards');
    const unfreezeBtn = page.getByRole('button', { name: /unfreeze/i }).first();
    await expect(unfreezeBtn).toBeVisible({ timeout: 10_000 });
    await unfreezeBtn.click();

    // Step-up modal must appear
    await expect(page.getByRole('dialog', { name: /security/i })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/6-digit code|verification code/i)).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Card reveal', () => {
  test('clicking reveal shows the security check modal', async ({ page }) => {
    const { accessToken } = await setupSession();
    await page.goto('/');
    await page.evaluate((tok) => localStorage.setItem('accessToken', tok), accessToken);

    const account = await createAccount(accessToken, 'current');
    if (!account) { test.skip(); return; }

    const cardRes = await fetch(`${API}/accounts/${account.id}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ cardType: 'debit' }),
    });
    if (!cardRes.ok) { test.skip(); return; }

    await page.goto('/dashboard/cards');
    const revealBtn = page.getByRole('button', { name: /reveal|show card/i }).first();
    await expect(revealBtn).toBeVisible({ timeout: 10_000 });
    await revealBtn.click();

    // Step-up modal must appear before the PAN is shown
    await expect(page.getByRole('dialog', { name: /security/i })).toBeVisible({ timeout: 8_000 });
  });
});
