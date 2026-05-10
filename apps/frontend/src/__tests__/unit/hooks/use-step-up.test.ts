import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStepUp } from '@/lib/use-step-up';

// ── Mock the API client ────────────────────────────────────────────────────────

const mockRequestOtp = vi.fn();
const mockVerifyOtp = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    auth: {
      requestOtp: (...args: any[]) => mockRequestOtp(...args),
      verifyOtp: (...args: any[]) => mockVerifyOtp(...args),
    },
  },
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));

// ─────────────────────────────────────────────────────────────────────────────

describe('useStepUp', () => {
  beforeEach(() => {
    mockRequestOtp.mockReset();
    mockVerifyOtp.mockReset();
  });

  // ── initial state ────────────────────────────────────────────────────────────

  it('starts with the modal closed and no errors', () => {
    const { result } = renderHook(() => useStepUp());

    expect(result.current.stepUp.isOpen).toBe(false);
    expect(result.current.stepUp.action).toBe('');
    expect(result.current.stepUp.otpToken).toBeNull();
    expect(result.current.stepUpError).toBe('');
    expect(result.current.requestingOtp).toBe(false);
    expect(result.current.verifyingOtp).toBe(false);
  });

  // ── requestStepUp() ─────────────────────────────────────────────────────────

  it('calls requestOtp and opens the modal on success', async () => {
    mockRequestOtp.mockResolvedValue(undefined);

    const { result } = renderHook(() => useStepUp());

    // Don't await the promise — it resolves when submitStepUp is called
    act(() => {
      result.current.requestStepUp('large_transfer');
    });

    await vi.waitFor(() => {
      expect(result.current.stepUp.isOpen).toBe(true);
    });
    expect(result.current.stepUp.action).toBe('large_transfer');
    expect(mockRequestOtp).toHaveBeenCalledWith('large_transfer');
    expect(result.current.requestingOtp).toBe(false);
  });

  it('throws and keeps the modal closed when requestOtp fails', async () => {
    mockRequestOtp.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useStepUp());

    await expect(
      act(() => result.current.requestStepUp('large_transfer')),
    ).rejects.toThrow();

    expect(result.current.stepUp.isOpen).toBe(false);
  });

  // ── submitStepUp() ──────────────────────────────────────────────────────────

  it('closes the modal and returns the otpToken on success', async () => {
    mockRequestOtp.mockResolvedValue(undefined);
    mockVerifyOtp.mockResolvedValue({ data: { otpToken: 'tok-abc' } });

    const { result } = renderHook(() => useStepUp());

    // Open the modal first
    act(() => { result.current.requestStepUp('large_transfer'); });
    await vi.waitFor(() => expect(result.current.stepUp.isOpen).toBe(true));

    let token: string;
    await act(async () => {
      token = await result.current.submitStepUp('123456');
    });

    expect(token!).toBe('tok-abc');
    expect(result.current.stepUp.isOpen).toBe(false);
    expect(result.current.stepUp.otpToken).toBe('tok-abc');
    expect(mockVerifyOtp).toHaveBeenCalledWith('large_transfer', '123456');
  });

  it('throws and keeps the modal open when OTP verification fails', async () => {
    mockRequestOtp.mockResolvedValue(undefined);
    mockVerifyOtp.mockRejectedValue(new Error('Invalid code'));

    const { result } = renderHook(() => useStepUp());

    act(() => { result.current.requestStepUp('large_transfer'); });
    await vi.waitFor(() => expect(result.current.stepUp.isOpen).toBe(true));

    await expect(
      act(async () => { await result.current.submitStepUp('000000'); }),
    ).rejects.toThrow('Invalid code');

    // modal stays open so the user can retry
    expect(result.current.stepUp.isOpen).toBe(true);
  });

  // ── dismissStepUp() ─────────────────────────────────────────────────────────

  it('closes the modal and rejects the pending promise', async () => {
    mockRequestOtp.mockResolvedValue(undefined);

    const { result } = renderHook(() => useStepUp());

    let stepUpPromise: Promise<string>;
    act(() => {
      stepUpPromise = result.current.requestStepUp('large_transfer');
    });
    await vi.waitFor(() => expect(result.current.stepUp.isOpen).toBe(true));

    act(() => { result.current.dismissStepUp(); });

    await expect(stepUpPromise!).rejects.toThrow('cancelled');
    expect(result.current.stepUp.isOpen).toBe(false);
    expect(result.current.stepUp.action).toBe('');
    expect(result.current.stepUpError).toBe('');
  });

  // ── handleStepUpRequired() ──────────────────────────────────────────────────

  it('calls requestOtp and opens the modal', async () => {
    mockRequestOtp.mockResolvedValue(undefined);

    const { result } = renderHook(() => useStepUp());

    act(() => { result.current.handleStepUpRequired('reveal_card'); });

    await vi.waitFor(() => expect(result.current.stepUp.isOpen).toBe(true));
    expect(mockRequestOtp).toHaveBeenCalledWith('reveal_card');
  });

  it('sets stepUpError when requestOtp fails in handleStepUpRequired', async () => {
    mockRequestOtp.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useStepUp());

    act(() => { result.current.handleStepUpRequired('reveal_card'); });

    await vi.waitFor(() => expect(result.current.stepUpError).toBe('Failed to send OTP.'));
    expect(result.current.stepUp.isOpen).toBe(false);
  });
});
