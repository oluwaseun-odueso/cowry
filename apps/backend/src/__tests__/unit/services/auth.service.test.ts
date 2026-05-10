import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole, FraudRiskLevel, AccountStatus } from '@cowry/types';
import { makeMockUser } from '../../helpers/auth-helpers';

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

vi.mock('../../../models', () => ({
  UserRepository: {
    findByEmail: vi.fn(),
    findByPhoneNumber: vi.fn(),
    findByTag: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setTag: vi.fn(),
    clearMfaSecret: vi.fn(),
    findByGoogleId: vi.fn(),
  },
  SessionRepository: {
    create: vi.fn(),
    findByRefreshToken: vi.fn(),
    findByRefreshTokenIgnoreValidity: vi.fn(),
    findActiveByUserId: vi.fn(),
    findRecentByUserId: vi.fn(),
    findByIdAndUserId: vi.fn(),
    findByToken: vi.fn(),
    invalidate: vi.fn(),
    invalidateByUserId: vi.fn(),
    invalidateByToken: vi.fn(),
  },
  FraudAlertRepository: { create: vi.fn() },
  MfaBackupCodeRepository: {
    createMany: vi.fn(),
    verifyAndConsume: vi.fn(),
    deleteByUserId: vi.fn(),
  },
  PasswordResetRepository: {
    create: vi.fn(),
    findAndVerify: vi.fn(),
    markUsed: vi.fn(),
  },
  EmailVerificationRepository: {
    create: vi.fn(),
    findAndVerify: vi.fn(),
    markUsed: vi.fn(),
  },
  comparePassword: vi.fn(),
  isLocked: vi.fn(),
  resetLoginAttempts: vi.fn(),
  toPublicUser: vi.fn((u: any) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    tag: u.tag,
  })),
}));

vi.mock('speakeasy', () => ({
  default: {
    generateSecret: vi.fn(() => ({
      base32: 'MOCK_MFA_SECRET_BASE32',
      otpauth_url: 'otpauth://totp/Cowry:test@example.com?secret=MOCK',
    })),
    totp: { verify: vi.fn() },
  },
}));

vi.mock('useragent', () => ({
  parse: vi.fn(() => ({
    family: 'Chrome',
    major: '120',
    os: { family: 'Windows', major: '10' },
    device: { family: 'Other' },
  })),
}));

// ── Imports after mock declarations ───────────────────────────────────────────

import { AuthService } from '../../../services/auth.service';
import {
  UserRepository,
  SessionRepository,
  FraudAlertRepository,
  MfaBackupCodeRepository,
  PasswordResetRepository,
  EmailVerificationRepository,
  comparePassword,
  isLocked,
  resetLoginAttempts,
} from '../../../models';
import speakeasy from 'speakeasy';

// ── Typed helpers ─────────────────────────────────────────────────────────────

const mUser = vi.mocked(UserRepository);
const mSession = vi.mocked(SessionRepository);
const mFraud = vi.mocked(FraudAlertRepository);
const mMfa = vi.mocked(MfaBackupCodeRepository);
const mPasswordReset = vi.mocked(PasswordResetRepository);
const mEmailVerify = vi.mocked(EmailVerificationRepository);
const mComparePassword = vi.mocked(comparePassword);
const mIsLocked = vi.mocked(isLocked);
const mResetAttempts = vi.mocked(resetLoginAttempts);
const mSpeakeasy = vi.mocked(speakeasy);

const CREDS = { ipAddress: '1.2.3.4', userAgent: 'TestAgent/1.0' };

// ─────────────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    // default stubs
    mSession.create.mockResolvedValue(undefined as any);
    mSession.findActiveByUserId.mockResolvedValue([]);
    mSession.findRecentByUserId.mockResolvedValue([]);
    mFraud.create.mockResolvedValue(undefined as any);
    mEmailVerify.create.mockResolvedValue(undefined as any);
  });

  // ── register() ──────────────────────────────────────────────────────────────

  describe('register()', () => {
    const payload = {
      email: 'new@example.com',
      password: 'Passw0rd!',
      firstName: 'Alice',
      lastName: 'Smith',
      phoneNumber: '+447700900001',
      ...CREDS,
    };

    it('creates a user, sets a tag, logs a fraud alert, and returns tokens', async () => {
      const mockUser = makeMockUser({ id: 'u1', email: 'new@example.com', firstName: 'Alice' });
      mUser.findByEmail.mockResolvedValue(null);
      mUser.findByPhoneNumber.mockResolvedValue(null);
      mUser.create.mockResolvedValue(mockUser as any);
      mUser.findByTag.mockResolvedValue(null); // tag is available
      mUser.setTag.mockResolvedValue(undefined as any);

      const result = await service.register(payload);

      expect(mUser.create).toHaveBeenCalledOnce();
      expect(mUser.setTag).toHaveBeenCalledWith('u1', expect.stringMatching(/^alice\d{4}$/));
      expect(mFraud.create).toHaveBeenCalledWith(
        expect.objectContaining({ ruleName: 'USER_REGISTRATION' }),
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('verificationToken');
    });

    it('throws when the email is already registered', async () => {
      mUser.findByEmail.mockResolvedValue(makeMockUser() as any);

      await expect(service.register(payload)).rejects.toThrow('already exists');
    });

    it('throws when the phone number is already in use', async () => {
      mUser.findByEmail.mockResolvedValue(null);
      mUser.findByPhoneNumber.mockResolvedValue(makeMockUser() as any);

      await expect(service.register(payload)).rejects.toThrow('phone number already exists');
    });
  });

  // ── login() ──────────────────────────────────────────────────────────────────

  describe('login()', () => {
    const creds = { email: 'test@example.com', password: 'Passw0rd!', ...CREDS };

    it('returns user + tokens on a successful login (no MFA)', async () => {
      const mockUser = makeMockUser({ isMfaEnabled: false, emailVerified: true, status: 'active' });
      mUser.findByEmail.mockResolvedValue(mockUser as any);
      mIsLocked.mockReturnValue(false);
      mComparePassword.mockResolvedValue(true);
      mResetAttempts.mockResolvedValue(mockUser as any);
      mUser.update.mockResolvedValue(undefined as any);

      const result = await service.login(creds);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('user');
      expect((result as any).mfaRequired).toBeUndefined();
    });

    it('returns { mfaRequired, challengeToken } when MFA is enabled', async () => {
      const mockUser = makeMockUser({ isMfaEnabled: true, mfaSecret: 'SECRET', emailVerified: true, status: 'active' });
      mUser.findByEmail.mockResolvedValue(mockUser as any);
      mIsLocked.mockReturnValue(false);
      mComparePassword.mockResolvedValue(true);
      mResetAttempts.mockResolvedValue(mockUser as any);

      const result: any = await service.login(creds);

      expect(result.mfaRequired).toBe(true);
      expect(result.challengeToken).toBeTruthy();
    });

    it('throws and logs fraud when password is wrong', async () => {
      const mockUser = makeMockUser({ loginAttempts: 0 });
      mUser.findByEmail.mockResolvedValue(mockUser as any);
      mIsLocked.mockReturnValue(false);
      mComparePassword.mockResolvedValue(false);
      mUser.update.mockResolvedValue(undefined as any);

      await expect(service.login(creds)).rejects.toThrow('Invalid email or password');
      expect(mUser.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ loginAttempts: 1 }),
      );
    });

    it('locks the account and creates a HIGH fraud alert on the 5th failed attempt', async () => {
      const mockUser = makeMockUser({ loginAttempts: 4 }); // about to reach max
      mUser.findByEmail.mockResolvedValue(mockUser as any);
      mIsLocked.mockReturnValue(false);
      mComparePassword.mockResolvedValue(false);
      mUser.update.mockResolvedValue(undefined as any);

      await expect(service.login(creds)).rejects.toThrow('Invalid email or password');

      expect(mUser.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          loginAttempts: 5,
          status: AccountStatus.LOCKED,
          lockUntil: expect.any(Date),
        }),
      );
      expect(mFraud.create).toHaveBeenCalledWith(
        expect.objectContaining({ ruleName: 'ACCOUNT_LOCKED', riskLevel: FraudRiskLevel.HIGH }),
      );
    });

    it('throws when the account is locked', async () => {
      const mockUser = makeMockUser({ lockUntil: new Date(Date.now() + 60_000) });
      mUser.findByEmail.mockResolvedValue(mockUser as any);
      mIsLocked.mockReturnValue(true); // account IS locked

      await expect(service.login(creds)).rejects.toThrow('temporarily locked');
      expect(mFraud.create).toHaveBeenCalledWith(
        expect.objectContaining({ ruleName: 'LOCKED_ACCOUNT_ATTEMPT', riskLevel: FraudRiskLevel.HIGH }),
      );
    });

    it('throws when email is not verified', async () => {
      const mockUser = makeMockUser({ emailVerified: false });
      mUser.findByEmail.mockResolvedValue(mockUser as any);
      mIsLocked.mockReturnValue(false);
      mComparePassword.mockResolvedValue(true);
      mResetAttempts.mockResolvedValue(mockUser as any);

      await expect(service.login(creds)).rejects.toThrow('verify your email');
    });

    it('throws when user is not found', async () => {
      mUser.findByEmail.mockResolvedValue(null);

      await expect(service.login(creds)).rejects.toThrow('Invalid email or password');
    });
  });

  // ── verifyEmail() ────────────────────────────────────────────────────────────

  describe('verifyEmail()', () => {
    it('marks email as verified and returns true', async () => {
      mEmailVerify.findAndVerify.mockResolvedValue({ id: 'ev1', userId: 'u1' } as any);
      mUser.update.mockResolvedValue(undefined as any);
      mEmailVerify.markUsed.mockResolvedValue(undefined as any);

      const result = await service.verifyEmail('valid-token');

      expect(mUser.update).toHaveBeenCalledWith('u1', { emailVerified: true });
      expect(mEmailVerify.markUsed).toHaveBeenCalledWith('ev1');
      expect(result).toBe(true);
    });

    it('throws for an invalid or expired token', async () => {
      mEmailVerify.findAndVerify.mockResolvedValue(null);

      await expect(service.verifyEmail('bad-token')).rejects.toThrow('Invalid or expired');
    });
  });

  // ── generatePasswordResetToken() ─────────────────────────────────────────────

  describe('generatePasswordResetToken()', () => {
    it('creates a reset record and returns a token when email exists', async () => {
      const user = makeMockUser();
      mUser.findByEmail.mockResolvedValue(user as any);
      mPasswordReset.create.mockResolvedValue(undefined as any);

      const token = await service.generatePasswordResetToken('test@example.com');

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(10);
      expect(mPasswordReset.create).toHaveBeenCalledWith(user.id, token);
    });

    it('still returns a token when the email does not exist (anti-enumeration)', async () => {
      mUser.findByEmail.mockResolvedValue(null);

      const token = await service.generatePasswordResetToken('nobody@example.com');

      expect(typeof token).toBe('string');
      expect(mPasswordReset.create).not.toHaveBeenCalled();
    });
  });

  // ── resetPassword() ──────────────────────────────────────────────────────────

  describe('resetPassword()', () => {
    it('updates password, invalidates sessions, marks token used', async () => {
      mPasswordReset.findAndVerify.mockResolvedValue({ id: 'pr1', userId: 'u1' } as any);
      mUser.update.mockResolvedValue(undefined as any);
      mSession.invalidateByUserId.mockResolvedValue(undefined as any);
      mPasswordReset.markUsed.mockResolvedValue(undefined as any);

      const result = await service.resetPassword('good-token', 'NewPassw0rd!');

      expect(mUser.update).toHaveBeenCalledWith('u1', { password: 'NewPassw0rd!' });
      expect(mSession.invalidateByUserId).toHaveBeenCalledWith('u1');
      expect(mPasswordReset.markUsed).toHaveBeenCalledWith('pr1');
      expect(result).toBe(true);
    });

    it('throws for an invalid or expired token', async () => {
      mPasswordReset.findAndVerify.mockResolvedValue(null);

      await expect(service.resetPassword('bad-token', 'NewPassw0rd!')).rejects.toThrow(
        'Invalid or expired password reset token',
      );
    });
  });

  // ── changePassword() ─────────────────────────────────────────────────────────

  describe('changePassword()', () => {
    it('updates password and invalidates all sessions', async () => {
      const user = makeMockUser();
      mUser.findById.mockResolvedValue(user as any);
      mComparePassword.mockResolvedValue(true);
      mUser.update.mockResolvedValue(undefined as any);
      mSession.invalidateByUserId.mockResolvedValue(undefined as any);

      await service.changePassword('u1', 'OldPass1!', 'NewPass1!');

      expect(mUser.update).toHaveBeenCalledWith('u1', { password: 'NewPass1!' });
      expect(mSession.invalidateByUserId).toHaveBeenCalledWith('u1');
    });

    it('throws when the current password is incorrect', async () => {
      mUser.findById.mockResolvedValue(makeMockUser() as any);
      mComparePassword.mockResolvedValue(false);

      await expect(service.changePassword('u1', 'wrong', 'New1!')).rejects.toThrow(
        'Current password is incorrect',
      );
    });

    it('throws when the user does not exist', async () => {
      mUser.findById.mockResolvedValue(null);

      await expect(service.changePassword('u1', 'any', 'new')).rejects.toThrow('User not found');
    });
  });

  // ── setupMfa() ───────────────────────────────────────────────────────────────

  describe('setupMfa()', () => {
    it('generates a TOTP secret, stores it, and returns otpauthUrl + secret', async () => {
      mUser.findById.mockResolvedValue(makeMockUser() as any);
      mUser.update.mockResolvedValue(undefined as any);

      const result = await service.setupMfa('u1');

      expect(mSpeakeasy.generateSecret).toHaveBeenCalledOnce();
      expect(mUser.update).toHaveBeenCalledWith('u1', { mfaSecret: 'MOCK_MFA_SECRET_BASE32' });
      expect(result.secret).toBe('MOCK_MFA_SECRET_BASE32');
      expect(result.otpauthUrl).toContain('otpauth://totp/');
    });

    it('throws when user is not found', async () => {
      mUser.findById.mockResolvedValue(null);

      await expect(service.setupMfa('u1')).rejects.toThrow('User not found');
    });
  });

  // ── enableMfa() ──────────────────────────────────────────────────────────────

  describe('enableMfa()', () => {
    it('enables MFA and returns 8 backup codes for a valid TOTP code', async () => {
      const user = makeMockUser({ mfaSecret: 'MOCK_MFA_SECRET_BASE32', isMfaEnabled: false });
      mUser.findById.mockResolvedValue(user as any);
      (mSpeakeasy.totp.verify as any).mockReturnValue(true);
      mMfa.createMany.mockResolvedValue(undefined as any);
      mUser.update.mockResolvedValue(undefined as any);

      const result = await service.enableMfa('u1', '123456');

      expect(result.backupCodes).toHaveLength(8);
      expect(mUser.update).toHaveBeenCalledWith('u1', { isMfaEnabled: true });
      expect(mFraud.create).toHaveBeenCalledWith(
        expect.objectContaining({ ruleName: 'MFA_ENABLED' }),
      );
    });

    it('throws for an invalid TOTP code', async () => {
      const user = makeMockUser({ mfaSecret: 'SECRET', isMfaEnabled: false });
      mUser.findById.mockResolvedValue(user as any);
      (mSpeakeasy.totp.verify as any).mockReturnValue(false);

      await expect(service.enableMfa('u1', '000000')).rejects.toThrow('Invalid authenticator code');
    });

    it('throws when MFA setup has not been initiated (no secret)', async () => {
      mUser.findById.mockResolvedValue(makeMockUser({ mfaSecret: null }) as any);

      await expect(service.enableMfa('u1', '123456')).rejects.toThrow('setup not initiated');
    });

    it('throws when MFA is already enabled', async () => {
      mUser.findById.mockResolvedValue(makeMockUser({ isMfaEnabled: true, mfaSecret: 'X' }) as any);

      await expect(service.enableMfa('u1', '123456')).rejects.toThrow('already enabled');
    });
  });

  // ── disableMfa() ─────────────────────────────────────────────────────────────

  describe('disableMfa()', () => {
    it('disables MFA via a valid TOTP code', async () => {
      const user = makeMockUser({ isMfaEnabled: true, mfaSecret: 'SECRET' });
      mUser.findById.mockResolvedValue(user as any);
      (mSpeakeasy.totp.verify as any).mockReturnValue(true);
      mUser.update.mockResolvedValue(undefined as any);
      mUser.clearMfaSecret.mockResolvedValue(undefined as any);
      mMfa.deleteByUserId.mockResolvedValue(undefined as any);

      await service.disableMfa('u1', '123456');

      expect(mUser.update).toHaveBeenCalledWith('u1', { isMfaEnabled: false });
      expect(mUser.clearMfaSecret).toHaveBeenCalledWith('u1');
      expect(mMfa.deleteByUserId).toHaveBeenCalledWith('u1');
      expect(mFraud.create).toHaveBeenCalledWith(
        expect.objectContaining({ ruleName: 'MFA_DISABLED', riskLevel: FraudRiskLevel.MEDIUM }),
      );
    });

    it('disables MFA via a valid backup code when TOTP fails', async () => {
      const user = makeMockUser({ isMfaEnabled: true, mfaSecret: 'SECRET' });
      mUser.findById.mockResolvedValue(user as any);
      (mSpeakeasy.totp.verify as any).mockReturnValue(false);
      mMfa.verifyAndConsume.mockResolvedValue(true);
      mUser.update.mockResolvedValue(undefined as any);
      mUser.clearMfaSecret.mockResolvedValue(undefined as any);
      mMfa.deleteByUserId.mockResolvedValue(undefined as any);

      await service.disableMfa('u1', 'ABCD1234');

      expect(mUser.update).toHaveBeenCalledWith('u1', { isMfaEnabled: false });
    });

    it('throws when both TOTP and backup code are invalid', async () => {
      const user = makeMockUser({ isMfaEnabled: true, mfaSecret: 'SECRET' });
      mUser.findById.mockResolvedValue(user as any);
      (mSpeakeasy.totp.verify as any).mockReturnValue(false);
      mMfa.verifyAndConsume.mockResolvedValue(false);

      await expect(service.disableMfa('u1', 'BADCODE')).rejects.toThrow('Invalid code');
    });

    it('throws when MFA is not currently enabled', async () => {
      mUser.findById.mockResolvedValue(makeMockUser({ isMfaEnabled: false }) as any);

      await expect(service.disableMfa('u1', '123456')).rejects.toThrow('not enabled');
    });
  });

  // ── refreshToken() ────────────────────────────────────────────────────────────

  describe('refreshToken()', () => {
    it('rotates tokens on a valid refresh token', async () => {
      const { makeRefreshToken, makeMockSession } = await import('../../helpers/auth-helpers');
      const user = makeMockUser();
      const token = makeRefreshToken(user.id, user.email);
      const session = makeMockSession(token, user.id);

      mSession.findByRefreshToken.mockResolvedValue(session as any);
      mUser.findById.mockResolvedValue({ ...user, status: 'active' } as any);
      mSession.invalidate.mockResolvedValue(undefined as any);

      const result = await service.refreshToken(token, '1.2.3.4', 'TestAgent');

      expect(mSession.invalidate).toHaveBeenCalledWith(session.id);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('revokes ALL sessions and throws on refresh token reuse', async () => {
      const { makeRefreshToken } = await import('../../helpers/auth-helpers');
      const user = makeMockUser();
      const token = makeRefreshToken(user.id, user.email);

      // Token not found as valid, but found as revoked
      mSession.findByRefreshToken.mockResolvedValue(null);
      mSession.findByRefreshTokenIgnoreValidity.mockResolvedValue({ id: 'old-sess' } as any);
      mSession.invalidateByUserId.mockResolvedValue(undefined as any);

      await expect(service.refreshToken(token, '5.5.5.5', 'HaxBot')).rejects.toThrow(
        'Invalid refresh token',
      );
      expect(mSession.invalidateByUserId).toHaveBeenCalledWith(user.id);
      expect(mFraud.create).toHaveBeenCalledWith(
        expect.objectContaining({ ruleName: 'REFRESH_TOKEN_REUSE', riskLevel: FraudRiskLevel.HIGH }),
      );
    });

    it('throws for a completely invalid / unsigned token', async () => {
      await expect(service.refreshToken('garbage', '1.2.3.4', 'UA')).rejects.toThrow(
        'Invalid refresh token',
      );
    });
  });

  // ── issueMfaChallengeToken() ──────────────────────────────────────────────────

  describe('issueMfaChallengeToken()', () => {
    it('returns a JWT with type=mfa_challenge', async () => {
      const jwt = await import('jsonwebtoken');
      const token = service.issueMfaChallengeToken('u1', 'test@example.com', UserRole.USER);
      const decoded: any = jwt.default.verify(token, process.env['JWT_SECRET']!);
      expect(decoded.type).toBe('mfa_challenge');
      expect(decoded.userId).toBe('u1');
    });
  });
});
