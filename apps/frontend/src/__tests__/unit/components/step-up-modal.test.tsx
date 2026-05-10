import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepUpModal } from '@/components/step-up-modal';

// Stub CSS module — we don't care about class names in tests
vi.mock('@/components/step-up-modal.module.css', () => ({
  default: new Proxy({}, { get: (_t, key) => String(key) }),
}));

// Stub lucide icons so JSDOM doesn't choke on SVG internals
vi.mock('lucide-react', () => ({
  Loader2: () => null,
  ShieldAlert: () => null,
  X: () => null,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultProps = {
  isOpen: true,
  action: 'large_transfer',
  error: '',
  verifying: false,
  onSubmit: vi.fn(),
  onDismiss: vi.fn(),
  onResend: vi.fn(),
  resending: false,
};

function renderModal(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  // Reset mock functions so state doesn't bleed between tests
  props.onSubmit = overrides.onSubmit ?? vi.fn();
  props.onDismiss = overrides.onDismiss ?? vi.fn();
  props.onResend = overrides.onResend ?? vi.fn();
  return { ...render(<StepUpModal {...props} />), props };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('StepUpModal', () => {
  describe('visibility', () => {
    it('renders nothing when isOpen is false', () => {
      render(<StepUpModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renders the dialog when isOpen is true', () => {
      renderModal();
      expect(screen.getByRole('dialog')).toBeDefined();
    });
  });

  describe('content', () => {
    it('shows the "Security check" heading', () => {
      renderModal();
      expect(screen.getByText('Security check')).toBeDefined();
    });

    it('displays the action label from OTP_ACTION_LABELS for large_transfer', () => {
      renderModal({ action: 'large_transfer' });
      // OTP_ACTION_LABELS['large_transfer'] = 'a large transfer'
      expect(screen.getByText(/large transfer/i)).toBeDefined();
    });

    it('shows the error message when the error prop is set', () => {
      renderModal({ error: 'Invalid verification code' });
      expect(screen.getByText('Invalid verification code')).toBeDefined();
    });

    it('hides the error message when error is empty', () => {
      renderModal({ error: '' });
      expect(screen.queryByText('Invalid verification code')).toBeNull();
    });
  });

  describe('code input', () => {
    it('accepts numeric input', async () => {
      const user = userEvent.setup();
      renderModal();
      const input = screen.getByPlaceholderText('000000') as HTMLInputElement;
      await user.type(input, '123456');
      expect(input.value).toBe('123456');
    });

    it('strips non-digit characters', async () => {
      const user = userEvent.setup();
      renderModal();
      const input = screen.getByPlaceholderText('000000') as HTMLInputElement;
      await user.type(input, 'abc123');
      expect(input.value).toBe('123');
    });

    it('truncates input to 6 digits', async () => {
      const user = userEvent.setup();
      renderModal();
      const input = screen.getByPlaceholderText('000000') as HTMLInputElement;
      await user.type(input, '1234567890');
      expect(input.value).toBe('123456');
    });
  });

  describe('submit behaviour', () => {
    it('calls onSubmit with the code when Confirm is clicked with 6 digits', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderModal({ onSubmit });

      const input = screen.getByPlaceholderText('000000');
      await user.type(input, '123456');

      const confirmBtn = screen.getByText('Confirm');
      await user.click(confirmBtn);

      expect(onSubmit).toHaveBeenCalledWith('123456');
    });

    it('does NOT call onSubmit when fewer than 6 digits are entered', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderModal({ onSubmit });

      const input = screen.getByPlaceholderText('000000');
      await user.type(input, '123');

      await user.click(screen.getByText('Confirm'));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('submits on Enter key press with 6 digits', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderModal({ onSubmit });

      const input = screen.getByPlaceholderText('000000');
      await user.type(input, '654321');
      await user.keyboard('{Enter}');

      expect(onSubmit).toHaveBeenCalledWith('654321');
    });

    it('Confirm button is disabled while verifying', () => {
      const { container } = renderModal({ verifying: true });
      // When verifying=true the button shows a spinner icon (no text), so query by class
      const btn = container.querySelector('button[disabled]') as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.disabled).toBe(true);
    });
  });

  describe('dismiss', () => {
    it('calls onDismiss when the cancel/X button is clicked', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      renderModal({ onDismiss });

      await user.click(screen.getByLabelText('Cancel'));
      expect(onDismiss).toHaveBeenCalledOnce();
    });
  });
});
