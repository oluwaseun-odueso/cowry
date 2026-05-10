/**
 * Integration tests for /api/v1/accounts/*
 *
 * Verifies routing, auth/MFA middleware chains, validation, and controller
 * response shapes.  AccountService is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { UserRole } from '@cowry/types';
import { makeAccessToken } from '../helpers/auth-helpers';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../config/database', () => ({
  default: { getConnection: vi.fn(), execute: vi.fn().mockResolvedValue([[], []]) },
  testConnection: vi.fn(),
}));

vi.mock('passport', async (importOriginal) => {
  const original: any = await importOriginal();
  return { ...original, authenticate: vi.fn(), initialize: vi.fn(() => (_: any, __: any, n: any) => n()), use: vi.fn() };
});

const mockAccountService = {
  createAccount: vi.fn(),
  getAccounts: vi.fn(),
  getAccount: vi.fn(),
  deposit: vi.fn(),
  withdraw: vi.fn(),
  transfer: vi.fn(),
  getTransactions: vi.fn(),
  getTransaction: vi.fn(),
  getStatement: vi.fn(),
};

vi.mock('../../services/account.service', () => ({
  AccountService: vi.fn(() => mockAccountService),
}));

vi.mock('../../services/auth.service', () => ({
  AuthService: vi.fn(() => ({
    register: vi.fn(),
    login: vi.fn(),
  })),
}));

vi.mock('../../models', () => ({
  UserRepository: { findById: vi.fn(), update: vi.fn() },
  SessionRepository: {
    findByToken: vi.fn().mockResolvedValue({ id: 's1', userId: 'user-001', isValid: true, expiresAt: new Date(Date.now() + 9e5_000) }),
    findByRefreshToken: vi.fn(),
    findActiveByUserId: vi.fn().mockResolvedValue([]),
  },
  FraudAlertRepository: { create: vi.fn() },
  MfaBackupCodeRepository: { createMany: vi.fn() },
  PasswordResetRepository: {},
  EmailVerificationRepository: {},
  comparePassword: vi.fn(),
  isLocked: vi.fn().mockReturnValue(false),
  resetLoginAttempts: vi.fn((u: any) => u),
  toPublicUser: vi.fn((u: any) => u),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import passport from 'passport';
import { createTestApp } from '../helpers/create-test-app';

const mfaUser = {
  id: 'user-001', email: 'test@example.com',
  role: UserRole.USER, status: 'active', isMfaEnabled: true,
};
const noMfaUser = { ...mfaUser, isMfaEnabled: false };

function asUser(user: typeof mfaUser | null) {
  (passport.authenticate as any).mockImplementation(
    (_: string, __: any, cb: Function) => (_req: any, _res: any, _next: any) => cb(null, user, null),
  );
}

const mockAccount = {
  id: 'acc-001', userId: 'user-001', accountNumber: '12345678',
  sortCode: '000000', accountType: 'savings', balance: 1000,
  currency: 'GBP', status: 'active',
};
const mockTx = {
  id: 'tx-001', accountId: 'acc-001', type: 'credit',
  amount: 100, currency: 'GBP', reference: 'REF-001',
  status: 'completed', createdAt: new Date(),
};

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/accounts', () => {
  const app = createTestApp();

  beforeEach(() => {
    mockAccountService.createAccount.mockResolvedValue(mockAccount);
  });

  it('returns 401 when unauthenticated', async () => {
    asUser(null);
    const res = await request(app).post('/api/v1/accounts').send({ type: 'savings' });
    expect(res.status).toBe(401);
  });

  it('returns 403 with mfaSetupRequired when MFA is not set up', async () => {
    asUser(noMfaUser);
    const res = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'test@example.com')}`)
      .send({ type: 'savings' });
    expect(res.status).toBe(403);
    expect(res.body.mfaSetupRequired).toBe(true);
  });

  it('returns 201 with the created account', async () => {
    asUser(mfaUser);
    const res = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'test@example.com')}`)
      .send({ type: 'savings' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ accountType: 'savings' });
  });

  it('returns 400 when an invalid account type is sent', async () => {
    asUser(mfaUser);
    const res = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'test@example.com')}`)
      .send({ type: 'invalid-type' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when the service throws a duplicate account error', async () => {
    asUser(mfaUser);
    mockAccountService.createAccount.mockRejectedValueOnce(new Error('You already have a savings account.'));
    const res = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'test@example.com')}`)
      .send({ type: 'savings' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/accounts', () => {
  const app = createTestApp();

  it('returns 200 with a list of accounts', async () => {
    asUser(mfaUser);
    mockAccountService.getAccounts.mockResolvedValue([mockAccount]);

    const res = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'test@example.com')}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 401 without a token', async () => {
    asUser(null);
    const res = await request(app).get('/api/v1/accounts');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/accounts/:id/deposit', () => {
  const app = createTestApp();

  beforeEach(() => {
    asUser(mfaUser);
    mockAccountService.deposit.mockResolvedValue({ transaction: mockTx, balance: 1100 });
  });

  it('returns 200 with transaction and new balance', async () => {
    const res = await request(app)
      .post('/api/v1/accounts/acc-001/deposit')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'test@example.com')}`)
      .send({ amount: 100 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('balance', 1100);
  });

  it('returns 400 when amount is 0', async () => {
    const res = await request(app)
      .post('/api/v1/accounts/acc-001/deposit')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'test@example.com')}`)
      .send({ amount: 0 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is missing', async () => {
    const res = await request(app)
      .post('/api/v1/accounts/acc-001/deposit')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'test@example.com')}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/accounts/:id/withdraw', () => {
  const app = createTestApp();

  beforeEach(() => {
    asUser(mfaUser);
  });

  it('returns 200 on a valid withdrawal', async () => {
    mockAccountService.withdraw.mockResolvedValue({ transaction: mockTx, balance: 900 });

    const res = await request(app)
      .post('/api/v1/accounts/acc-001/withdraw')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'test@example.com')}`)
      .send({ amount: 100 });

    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(900);
  });

  it('returns 400 for insufficient funds', async () => {
    mockAccountService.withdraw.mockRejectedValueOnce(new Error('Insufficient funds.'));

    const res = await request(app)
      .post('/api/v1/accounts/acc-001/withdraw')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'test@example.com')}`)
      .send({ amount: 9999 });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/accounts/:id/transfer', () => {
  const app = createTestApp();

  beforeEach(() => {
    asUser(mfaUser);
  });

  it('returns 200 on a valid transfer', async () => {
    mockAccountService.transfer.mockResolvedValue({
      transfer: { id: 'tr-001', amount: 200, status: 'completed' },
      balance: 800,
    });

    const res = await request(app)
      .post('/api/v1/accounts/acc-001/transfer')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'test@example.com')}`)
      .send({ toAccountNumber: '87654321', amount: 200 });

    expect(res.status).toBe(200);
  });

  it('returns 400 when toAccountNumber is missing', async () => {
    const res = await request(app)
      .post('/api/v1/accounts/acc-001/transfer')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'test@example.com')}`)
      .send({ amount: 100 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is zero', async () => {
    const res = await request(app)
      .post('/api/v1/accounts/acc-001/transfer')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'test@example.com')}`)
      .send({ toAccountNumber: '87654321', amount: 0 });

    expect(res.status).toBe(400);
  });
});
