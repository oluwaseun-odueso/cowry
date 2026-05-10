import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Module stubs ───────────────────────────────────────────────────────────────

vi.mock('@/app/(auth)/login/page.module.css', () => ({
  default: new Proxy({}, { get: (_t, k) => String(k) }),
}));

vi.mock('lucide-react', () => ({
  Eye: () => null,
  EyeOff: () => null,
  Loader2: () => null,
  Lock: () => null,
}));

vi.mock('@/components/cowry-logo', () => ({
  CowryLogo: () => null,
}));

const mockLogin = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ login: mockLogin, user: null, logout: vi.fn() }),
}));

const mockApiLogin = vi.fn();

vi.mock('@/lib/api', () => ({
  api: { auth: { login: (...args: any[]) => mockApiLogin(...args) } },
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
}));

// ── Component import (after mocks) ────────────────────────────────────────────

import LoginPage from '@/app/(auth)/login/page';

// ─────────────────────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockPush.mockReset();
    mockApiLogin.mockReset();
  });

  it('renders the email and password fields', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText('you@example.com')).toBeDefined();
    expect(screen.getByPlaceholderText('••••••••')).toBeDefined();
  });

  it('renders the forgot password link', () => {
    render(<LoginPage />);
    const link = screen.getByText(/forgot password/i) as HTMLAnchorElement;
    expect(link.href).toContain('/forgot-password');
  });

  describe('successful login — no MFA', () => {
    it('calls login() and redirects to /dashboard for MFA-enabled users', async () => {
      const user = userEvent.setup();
      mockApiLogin.mockResolvedValue({
        data: {
          accessToken: 'tok',
          refreshToken: 'ref',
          expiresIn: 900,
          user: { id: 'u1', email: 'a@b.com', isMfaEnabled: true },
        },
      });

      render(<LoginPage />);
      await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'Passw0rd!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => expect(mockLogin).toHaveBeenCalledOnce());
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    it('redirects to /setup-mfa for users who have not yet enabled MFA', async () => {
      const user = userEvent.setup();
      mockApiLogin.mockResolvedValue({
        data: {
          accessToken: 'tok',
          refreshToken: 'ref',
          expiresIn: 900,
          user: { id: 'u1', email: 'a@b.com', isMfaEnabled: false },
        },
      });

      render(<LoginPage />);
      await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'Passw0rd!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/setup-mfa'));
    });
  });

  describe('MFA required', () => {
    it('redirects to /verify-mfa with the challenge token', async () => {
      const user = userEvent.setup();
      mockApiLogin.mockResolvedValue({
        data: { mfaRequired: true, challengeToken: 'ch-token-123' },
      });

      render(<LoginPage />);
      await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'Passw0rd!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('/verify-mfa?token=ch-token-123'),
        ),
      );
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('error states', () => {
    it('displays an API error message', async () => {
      const { ApiError } = await import('@/lib/api');
      const user = userEvent.setup();
      mockApiLogin.mockRejectedValue(new ApiError(401, 'Invalid email or password'));

      render(<LoginPage />);
      await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpw');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() =>
        expect(screen.getByText('Invalid email or password')).toBeDefined(),
      );
    });

    it('shows a generic message on unexpected errors', async () => {
      const user = userEvent.setup();
      mockApiLogin.mockRejectedValue(new Error('Network failure'));

      render(<LoginPage />);
      await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'pw');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() =>
        expect(screen.getByText(/something went wrong/i)).toBeDefined(),
      );
    });
  });
});
