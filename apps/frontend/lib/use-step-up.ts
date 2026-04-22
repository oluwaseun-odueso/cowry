"use client";

import { useCallback, useRef, useState } from "react";
import { api, ApiError } from "./api";

export interface StepUpState {
  isOpen: boolean;
  action: string;
  otpToken: string | null;
}

export interface UseStepUpReturn {
  stepUp: StepUpState;
  /** Call this when the user initiates a high-risk action. Returns an otpToken on success. */
  requestStepUp: (action: string) => Promise<string>;
  /** Call inside a catch block when you receive a 403 stepUpRequired response. */
  handleStepUpRequired: (action: string) => void;
  dismissStepUp: () => void;
  submitStepUp: (code: string) => Promise<string>;
  requestingOtp: boolean;
  verifyingOtp: boolean;
  stepUpError: string;
}

export function useStepUp(): UseStepUpReturn {
  const [stepUp, setStepUp] = useState<StepUpState>({ isOpen: false, action: "", otpToken: null });
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [stepUpError, setStepUpError] = useState("");

  // Resolve/reject for the pending promise returned by requestStepUp
  const resolveRef = useRef<((token: string) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);

  const requestStepUp = useCallback(async (action: string): Promise<string> => {
    setRequestingOtp(true);
    setStepUpError("");
    try {
      await api.auth.requestOtp(action);
      setStepUp({ isOpen: true, action, otpToken: null });
      return new Promise<string>((resolve, reject) => {
        resolveRef.current = resolve;
        rejectRef.current = reject;
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to send OTP. Please try again.";
      setStepUpError(msg);
      throw new Error(msg);
    } finally {
      setRequestingOtp(false);
    }
  }, []);

  const handleStepUpRequired = useCallback((action: string) => {
    // Open the modal and send the OTP automatically
    setRequestingOtp(true);
    setStepUpError("");
    api.auth.requestOtp(action)
      .then(() => {
        setStepUp({ isOpen: true, action, otpToken: null });
        // Caller must await the same requestStepUp promise pattern
      })
      .catch(() => setStepUpError("Failed to send OTP."))
      .finally(() => setRequestingOtp(false));
  }, []);

  const submitStepUp = useCallback(async (code: string): Promise<string> => {
    setVerifyingOtp(true);
    setStepUpError("");
    try {
      const res = await api.auth.verifyOtp(stepUp.action, code);
      const { otpToken } = res.data;
      setStepUp((s) => ({ ...s, isOpen: false, otpToken }));
      resolveRef.current?.(otpToken);
      resolveRef.current = null;
      rejectRef.current = null;
      return otpToken;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Invalid code. Please try again.";
      setStepUpError(msg);
      throw new Error(msg);
    } finally {
      setVerifyingOtp(false);
    }
  }, [stepUp.action]);

  const dismissStepUp = useCallback(() => {
    setStepUp({ isOpen: false, action: "", otpToken: null });
    rejectRef.current?.(new Error("Step-up cancelled by user."));
    resolveRef.current = null;
    rejectRef.current = null;
    setStepUpError("");
  }, []);

  return { stepUp, requestStepUp, handleStepUpRequired, dismissStepUp, submitStepUp, requestingOtp, verifyingOtp, stepUpError };
}
