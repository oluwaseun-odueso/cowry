/**
 * Integration tests for /api/v1/auth/*
 *
 * Strategy: the database pool and all repositories are mocked so no MySQL
 * connection is required.  AuthService is also mocked so we test the HTTP
 * contract (routing, middleware chains, validation, controller response
 * shaping) without re-testing service logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { UserRole } from '@cowry/types';

// ── Module mocks (hoisted before any imports) ──────────────────────────────────

vi.mock('../../config/database', () => ({
  default: {
    getConnection: vi.fn().mockResolvedValue({
      beginTransaction: vi.fn(),
      execute: vi.fn().mockResolvedValue([[], []]),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    }),
    execute: vi.fn().mockResolvedValue([[], []]),
  },
  testConnection: vi.fn(),
}));

// Mock passport so JWT authentication is controllable per-test
vi.mock('passport', async (importOriginal) => {
  const original: any = await importOriginal();
  return {
    ...original,
    authenticate: vi.fn(),
    initialize: vi.fn(() => (_req: any, _res: any, next: any) => next()),
    use: vi.fn(),
  };
});

// Default: authentication resolves to a logged-in regular user
const mockUser = {
  id: 'user-001',
  email: 'test@example.com',
  role: UserRole.USER,
  status: 'active',
  isMfaEnabled: true,
};

const mockRegisterResult = {
  user: { id: 'u1', email: 'new@example.com', firstName: 'Test', lastName: 'User' },
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 900,
  verificationToken: 'verify-token',
};

const mockLoginResult = {
  user: { id: 'u1', email: 'test@example.com' },
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 900,
};

const mockAuthService = {
  register: vi.fn().mockResolvedValue(mockRegisterResult),
  login: vi.fn().mockResolvedValue(mockLoginResult),
  verifyMfaChallenge: vi.fn().mockResolvedValue(mockLoginResult),
  refreshToken: vi.fn().mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 900 }),
  generatePasswordResetToken: vi.fn().mockResolvedValue('reset-token'),
  resetPassword: vi.fn().mockResolvedValue(true),
  verifyEmail: vi.fn().mockResolvedValue(true),
  generateEmailVerificationToken: vi.fn().mockResolvedValue('verify-token'),
  setupMfa: vi.fn().mockResolvedValue({ otpauthUrl: 'otpauth://totp/...', secret: 'SECRET' }),
  enableMfa: vi.fn().mockResolvedValue({ backupCodes: ['CODE1', 'CODE2'] }),
  disableMfa: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  getUserSessions: vi.fn().mockResolvedValue([]),
  revokeSession: vi.fn().mockResolvedValue(true),
  changePassword: vi.fn().mockResolvedValue(true),
};

vi.mock('../../services/auth.service', () => ({
  AuthService: vi.fn(() => mockAuthService),
}));

// SessionRepository needed by AuthMiddleware
vi.mock('../../models', () => ({
  UserRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    findByTag: vi.fn(),
    create: vi.fn(),
    setTag: vi.fn(),
    findByPhoneNumber: vi.fn(),
  },
  SessionRepository: {
    findByToken: vi.fn().mockResolvedValue({ id: 's1', userId: 'user-001', isValid: true, expiresAt: new Date(Date.now() + 9e5 * 1000) }),
    findByRefreshToken: vi.fn(),
    findByIdAndUserId: vi.fn(),
    invalidate: vi.fn(),
    invalidateByUserId: vi.fn(),
    findActiveByUserId: vi.fn().mockResolvedValue([]),
  },
  FraudAlertRepository: { create: vi.fn() },
  MfaBackupCodeRepository: { createMany: vi.fn(), verifyAndConsume: vi.fn(), deleteByUserId: vi.fn() },
  PasswordResetRepository: { create: vi.fn(), findAndVerify: vi.fn(), markUsed: vi.fn() },
  EmailVerificationRepository: { create: vi.fn(), findAndVerify: vi.fn(), markUsed: vi.fn() },
  comparePassword: vi.fn(),
  isLocked: vi.fn().mockReturnValue(false),
  resetLoginAttempts: vi.fn((u: any) => u),
  toPublicUser: vi.fn((u: any) => ({ id: u.id, email: u.email })),
}));

vi.mock('../../models/fraudAlert', () => ({ FraudAlertRepository: { create: vi.fn() } }));
vi.mock('../../models/session', () => ({
  SessionRepository: {
    findByToken: vi.fn().mockResolvedValue({ id: 's1', userId: 'user-001', isValid: true }),
    findByRefreshToken: vi.fn(),
  },
}));

// ── App + passport setup ───────────────────────────────────────────────────────

import passport from 'passport';
import { createTestApp } from '../helpers/create-test-app';
import { makeAccessToken } from '../helpers/auth-helpers';

function setAuthUser(user: typeof mockUser | null) {
  (passport.authenticate as any).mockImplementation(
    (_strategy: string, _opts: any, callback: Function) =>
      (_req: any, _res: any, _next: any) =>
        callback(null, user, null),
  );
}

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  const app = createTestApp();
  const validPayload = {
    email: 'new@example.com',
    password: 'Passw0rd!',
    firstName: 'Test',
    lastName: 'User',
    phoneNumber: '+447700900001',
  };

  beforeEach(() => {
    mockAuthService.register.mockResolvedValue(mockRegisterResult);
  });

  it('returns 201 with tokens on valid payload', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('user');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'x@x.com' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });

  it('returns 400 when the password is too weak', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, password: 'simple' });

    expect(res.status).toBe(400);
  });

  it('returns 409 when the service throws a duplicate email error', async () => {
    mockAuthService.register.mockRejectedValueOnce(new Error('User with this email already exists'));

    const res = await request(app).post('/api/v1/auth/register').send(validPayload);

    expect(res.status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  const app = createTestApp();
  const validPayload = { email: 'test@example.com', password: 'Passw0rd!' };

  it('returns 200 with tokens on successful login', async () => {
    mockAuthService.login.mockResolvedValue(mockLoginResult);

    const res = await request(app).post('/api/v1/auth/login').send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('returns 200 with mfaRequired flag when MFA is enabled', async () => {
    mockAuthService.login.mockResolvedValue({ mfaRequired: true, challengeToken: 'ch-tok' } as any);

    const res = await request(app).post('/api/v1/auth/login').send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body.data.mfaRequired).toBe(true);
    expect(res.body.data.challengeToken).toBe('ch-tok');
  });

  it('returns 401 on invalid credentials', async () => {
    mockAuthService.login.mockRejectedValueOnce(new Error('Invalid email or password'));

    const res = await request(app).post('/api/v1/auth/login').send(validPayload);

    expect(res.status).toBe(401);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ password: 'pw' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/verify-mfa', () => {
  const app = createTestApp();

  it('returns 200 with full session tokens', async () => {
    mockAuthService.verifyMfaChallenge.mockResolvedValue(mockLoginResult);

    const res = await request(app)
      .post('/api/v1/auth/verify-mfa')
      .send({ challengeToken: 'ch', code: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('returns 401 when the MFA code is invalid', async () => {
    mockAuthService.verifyMfaChallenge.mockRejectedValueOnce(new Error('Invalid MFA code'));

    const res = await request(app)
      .post('/api/v1/auth/verify-mfa')
      .send({ challengeToken: 'ch', code: '000000' });

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/forgot-password', () => {
  const app = createTestApp();

  it('always returns 200 regardless of whether email exists (anti-enumeration)', async () => {
    mockAuthService.generatePasswordResetToken.mockResolvedValue('some-token');

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'anyone@example.com' });

    expect(res.status).toBe(200);
  });

  it('returns 400 for an invalid email address', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/verify-email', () => {
  const app = createTestApp();
  const validToken = 'a'.repeat(64);

  it('returns 200 on a valid token', async () => {
    mockAuthService.verifyEmail.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: validToken });

    expect(res.status).toBe(200);
  });

  it('returns 400 on an invalid token', async () => {
    mockAuthService.verifyEmail.mockRejectedValueOnce(new Error('Invalid or expired verification token'));

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: validToken });

    expect(res.status).toBe(400);
  });

  it('returns 400 when token is missing', async () => {
    const res = await request(app).post('/api/v1/auth/verify-email').send({});
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/profile', () => {
  const app = createTestApp();

  it('returns 401 when no auth token is provided', async () => {
    setAuthUser(null);

    const res = await request(app).get('/api/v1/auth/profile');
    expect(res.status).toBe(401);
  });

  it('returns 200 with the user object for an authenticated request', async () => {
    setAuthUser(mockUser);

    const res = await request(app)
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'test@example.com')}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('email');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/change-password', () => {
  const app = createTestApp();

  it('returns 403 when the step-up X-OTP-Token header is missing', async () => {
    setAuthUser(mockUser);

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'test@example.com')}`)
      .send({ currentPassword: 'Old1!', newPassword: 'New1!Passw0rd' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ stepUpRequired: true });
  });
});
