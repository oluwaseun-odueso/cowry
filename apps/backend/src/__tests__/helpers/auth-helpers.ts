import jwt from 'jsonwebtoken';
import { UserRole } from '@cowry/types';

const JWT_SECRET = process.env['JWT_SECRET']!;
const JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET']!;

/** Signs a short-lived access token with the test secret. */
export function makeAccessToken(
  userId: string,
  email: string,
  role: UserRole = UserRole.USER,
): string {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: '15m', issuer: 'the-bank-api', audience: 'the-bank-client' },
  );
}

/** Signs a refresh token with the test refresh secret. */
export function makeRefreshToken(
  userId: string,
  email: string,
  role: UserRole = UserRole.USER,
): string {
  return jwt.sign(
    { userId, email, role },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d', issuer: 'the-bank-api', audience: 'the-bank-client' },
  );
}

/** Returns a baseline mock user object with sensible defaults. */
export function makeMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-001',
    email: 'test@example.com',
    password: '$2b$10$hashedpassword',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.USER,
    status: 'active',
    isMfaEnabled: false,
    mfaSecret: null,
    emailVerified: true,
    phoneNumber: '+447700900000',
    tag: 'test1234',
    avatar: null,
    profilePicture: null,
    loginAttempts: 0,
    lockUntil: null,
    lastLogin: null,
    lastLoginIp: null,
    refreshToken: null,
    googleId: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

/** Returns a baseline mock account object. */
export function makeMockAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acc-001',
    userId: 'user-001',
    accountNumber: '12345678',
    sortCode: '000000',
    accountType: 'savings',
    balance: 1000,
    currency: 'GBP',
    status: 'active',
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}

/** Returns a mock session object. */
export function makeMockSession(token: string, userId: string) {
  return {
    id: 'sess-001',
    userId,
    token,
    refreshToken: 'some-refresh-token',
    ipAddress: '127.0.0.1',
    userAgent: 'Test/1.0',
    deviceInfo: { browser: 'Chrome 120', os: 'Windows 10', device: 'Other', isMobile: false },
    location: null,
    isValid: true,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };
}
