/**
 * Integration tests for /api/v1/admin/*
 *
 * Verifies role-based access control and response shaping for admin endpoints.
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

vi.mock('../../services/auth.service', () => ({ AuthService: vi.fn(() => ({})) }));
vi.mock('../../services/account.service', () => ({ AccountService: vi.fn(() => ({})) }));

const mockAdminController = {
  getAuditLog: vi.fn((req: any, res: any) => res.status(200).json({ status: 'success', data: { alerts: [], total: 0 } })),
  resolveAlert: vi.fn((req: any, res: any) => res.status(200).json({ status: 'success', data: { message: 'resolved' } })),
  getUsers: vi.fn((req: any, res: any) => res.status(200).json({ status: 'success', data: { users: [] } })),
};

vi.mock('../../controllers/admin.controller', () => ({
  AdminController: vi.fn(() => mockAdminController),
}));

vi.mock('../../models', () => ({
  UserRepository: { findById: vi.fn(), update: vi.fn() },
  SessionRepository: {
    findByToken: vi.fn().mockResolvedValue({ id: 's1', userId: 'user-001', isValid: true, expiresAt: new Date(Date.now() + 9e5_000) }),
    findByRefreshToken: vi.fn(),
    findActiveByUserId: vi.fn().mockResolvedValue([]),
  },
  FraudAlertRepository: { create: vi.fn() },
  MfaBackupCodeRepository: {},
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

const adminUser = { id: 'admin-001', email: 'admin@cowry.com', role: UserRole.ADMIN, status: 'active', isMfaEnabled: true };
const regularUser = { id: 'user-001', email: 'user@cowry.com', role: UserRole.USER, status: 'active', isMfaEnabled: true };

function asUser(user: typeof adminUser | null) {
  (passport.authenticate as any).mockImplementation(
    (_: string, __: any, cb: Function) => (_req: any, _res: any, _next: any) => cb(null, user, null),
  );
}

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/admin/audit-log', () => {
  const app = createTestApp();

  it('returns 401 when unauthenticated', async () => {
    asUser(null);
    const res = await request(app).get('/api/v1/admin/audit-log');
    expect(res.status).toBe(401);
  });

  it('returns 403 when a regular USER makes the request', async () => {
    asUser(regularUser);
    const res = await request(app)
      .get('/api/v1/admin/audit-log')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'user@cowry.com', UserRole.USER)}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 with paginated alerts for an ADMIN', async () => {
    asUser(adminUser);
    const res = await request(app)
      .get('/api/v1/admin/audit-log')
      .set('Authorization', `Bearer ${makeAccessToken('admin-001', 'admin@cowry.com', UserRole.ADMIN)}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('alerts');
  });

  it('passes query parameters through to the controller', async () => {
    asUser(adminUser);
    await request(app)
      .get('/api/v1/admin/audit-log?riskLevel=high&page=2&limit=10')
      .set('Authorization', `Bearer ${makeAccessToken('admin-001', 'admin@cowry.com', UserRole.ADMIN)}`);
    expect(mockAdminController.getAuditLog).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/v1/admin/audit-log/:alertId/resolve', () => {
  const app = createTestApp();

  it('returns 403 for a non-admin user', async () => {
    asUser(regularUser);
    const res = await request(app)
      .patch('/api/v1/admin/audit-log/alert-001/resolve')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'user@cowry.com', UserRole.USER)}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 when resolved by an admin', async () => {
    asUser(adminUser);
    const res = await request(app)
      .patch('/api/v1/admin/audit-log/alert-001/resolve')
      .set('Authorization', `Bearer ${makeAccessToken('admin-001', 'admin@cowry.com', UserRole.ADMIN)}`);
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/admin/users', () => {
  const app = createTestApp();

  it('returns 401 without authentication', async () => {
    asUser(null);
    const res = await request(app).get('/api/v1/admin/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a regular user', async () => {
    asUser(regularUser);
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${makeAccessToken('user-001', 'user@cowry.com', UserRole.USER)}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 with a users array for an admin', async () => {
    asUser(adminUser);
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${makeAccessToken('admin-001', 'admin@cowry.com', UserRole.ADMIN)}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('users');
  });
});
