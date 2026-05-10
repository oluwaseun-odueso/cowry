import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireStepUp } from '../../../middleware/stepup.middleware';

const SECRET = process.env['JWT_SECRET']!;
const USER_ID = 'user-001';

function mockReq(
  token: string | undefined,
  userId: string = USER_ID,
): Request {
  return {
    headers: token ? { 'x-otp-token': token } : {},
    user: { id: userId, email: 'test@example.com', role: 'user', status: 'active', isMfaEnabled: true },
  } as unknown as Request;
}

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function makeStepUpToken(
  action: string,
  userId: string = USER_ID,
  type: string = 'step_up',
  expiresIn: string | number = '10m',
): string {
  return jwt.sign({ userId, action, type }, SECRET, { expiresIn } as any);
}

// ─────────────────────────────────────────────────────────────────────────────

describe('requireStepUp middleware', () => {
  describe('missing token', () => {
    it('returns 403 with stepUpRequired flag when header is absent', () => {
      const next = vi.fn();
      const res = mockRes();

      requireStepUp('large_transfer')(mockReq(undefined), res, next);

      expect((res as any).status).toHaveBeenCalledWith(403);
      expect((res as any).json).toHaveBeenCalledWith(
        expect.objectContaining({ stepUpRequired: true, action: 'large_transfer' }),
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('valid token', () => {
    it('calls next() when token matches the required action and user', () => {
      const token = makeStepUpToken('large_transfer');
      const next = vi.fn();
      const res = mockRes();

      requireStepUp('large_transfer')(mockReq(token), res, next);

      expect(next).toHaveBeenCalledOnce();
      expect((res as any).status).not.toHaveBeenCalled();
    });
  });

  describe('wrong action', () => {
    it('returns 403 when the token was issued for a different action', () => {
      const token = makeStepUpToken('reveal_card'); // not large_transfer
      const next = vi.fn();
      const res = mockRes();

      requireStepUp('large_transfer')(mockReq(token), res, next);

      expect((res as any).status).toHaveBeenCalledWith(403);
      expect((res as any).json).toHaveBeenCalledWith(
        expect.objectContaining({ stepUpRequired: true, action: 'large_transfer' }),
      );
    });
  });

  describe('wrong token type', () => {
    it('returns 403 when type is not "step_up"', () => {
      const token = makeStepUpToken('large_transfer', USER_ID, 'mfa_challenge');
      const next = vi.fn();
      const res = mockRes();

      requireStepUp('large_transfer')(mockReq(token), res, next);

      expect((res as any).status).toHaveBeenCalledWith(403);
    });
  });

  describe('user mismatch', () => {
    it('returns 403 when token userId differs from req.user.id', () => {
      const token = makeStepUpToken('large_transfer', 'other-user-999');
      const next = vi.fn();
      const res = mockRes();

      // req.user.id is USER_ID = 'user-001', token userId is 'other-user-999'
      requireStepUp('large_transfer')(mockReq(token, USER_ID), res, next);

      expect((res as any).status).toHaveBeenCalledWith(403);
    });
  });

  describe('expired token', () => {
    it('returns 403 for a token that has already expired', () => {
      const token = makeStepUpToken('large_transfer', USER_ID, 'step_up', -1);
      const next = vi.fn();
      const res = mockRes();

      requireStepUp('large_transfer')(mockReq(token), res, next);

      expect((res as any).status).toHaveBeenCalledWith(403);
    });
  });

  describe('malformed token', () => {
    it('returns 403 for a garbage string', () => {
      const next = vi.fn();
      const res = mockRes();

      requireStepUp('large_transfer')(mockReq('not.a.real.jwt'), res, next);

      expect((res as any).status).toHaveBeenCalledWith(403);
    });
  });
});
