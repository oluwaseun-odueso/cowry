import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { AuthMiddleware } from '../../../middleware/auth.middleware';
import { UserRole } from '@cowry/types';

// ── helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function makeUser(overrides: Partial<Express.User> = {}): Express.User {
  return {
    id: 'user-001',
    email: 'test@example.com',
    role: UserRole.USER,
    status: 'active',
    isMfaEnabled: false,
    ...overrides,
  };
}

// ── authorize() ───────────────────────────────────────────────────────────────

describe('AuthMiddleware.authorize', () => {
  it('calls next() when user has a permitted role', () => {
    const req = { user: makeUser({ role: UserRole.ADMIN }) } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    AuthMiddleware.authorize(UserRole.ADMIN)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('accepts any of multiple permitted roles', () => {
    const req = { user: makeUser({ role: UserRole.USER }) } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    AuthMiddleware.authorize(UserRole.USER, UserRole.ADMIN)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 403 when user role is not in the allowed list', () => {
    const req = { user: makeUser({ role: UserRole.USER }) } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    AuthMiddleware.authorize(UserRole.ADMIN)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Insufficient permissions') }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when req.user is missing', () => {
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn();

    AuthMiddleware.authorize(UserRole.ADMIN)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── requireMfa() ──────────────────────────────────────────────────────────────

describe('AuthMiddleware.requireMfa', () => {
  it('calls next() when MFA is enabled', () => {
    const req = { user: makeUser({ isMfaEnabled: true }) } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    AuthMiddleware.requireMfa(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 403 with mfaSetupRequired when MFA is disabled', () => {
    const req = { user: makeUser({ isMfaEnabled: false }) } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    AuthMiddleware.requireMfa(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ mfaSetupRequired: true }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when req.user is missing', () => {
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn();

    AuthMiddleware.requireMfa(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

// ── isAdmin() ─────────────────────────────────────────────────────────────────

describe('AuthMiddleware.isAdmin', () => {
  it('calls next() for an ADMIN user', () => {
    const req = { user: makeUser({ role: UserRole.ADMIN }) } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    AuthMiddleware.isAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 403 for a USER', () => {
    const req = { user: makeUser({ role: UserRole.USER }) } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    AuthMiddleware.isAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Admin access required') }),
    );
  });

  it('returns 401 when req.user is absent', () => {
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn();

    AuthMiddleware.isAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

// ── extractClientInfo() ───────────────────────────────────────────────────────

describe('AuthMiddleware.extractClientInfo', () => {
  it('strips the ::ffff: prefix from IPv6-mapped IPv4 addresses', () => {
    const req = {
      ip: '::ffff:192.168.1.1',
      socket: { remoteAddress: undefined },
      headers: { 'user-agent': 'TestAgent/1.0' },
    } as unknown as Request;

    const { ipAddress, userAgent } = AuthMiddleware.extractClientInfo(req);

    expect(ipAddress).toBe('192.168.1.1');
    expect(userAgent).toBe('TestAgent/1.0');
  });

  it('returns plain IPv4 addresses unchanged', () => {
    const req = {
      ip: '10.0.0.1',
      socket: { remoteAddress: undefined },
      headers: { 'user-agent': 'Bot/2.0' },
    } as unknown as Request;

    const { ipAddress } = AuthMiddleware.extractClientInfo(req);

    expect(ipAddress).toBe('10.0.0.1');
  });

  it('falls back to socket.remoteAddress when req.ip is undefined', () => {
    const req = {
      ip: undefined,
      socket: { remoteAddress: '172.16.0.5' },
      headers: {},
    } as unknown as Request;

    const { ipAddress, userAgent } = AuthMiddleware.extractClientInfo(req);

    expect(ipAddress).toBe('172.16.0.5');
    expect(userAgent).toBe('unknown');
  });
});
