"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldAlert, X } from "lucide-react";
import styles from "./step-up-modal.module.css";

const ACTION_LABELS: Record<string, string> = {
  large_transfer:  "a transfer over £500",
  change_password: "a password change",
  unfreeze_card:   "unfreezing your card",
  cancel_card:     "cancelling your card",
  disable_mfa:     "disabling two-factor authentication",
  reveal_card:     "viewing your full card details",
  unblock_card:    "unblocking your card",
};

interface StepUpModalProps {
  isOpen: boolean;
  action: string;
  error: string;
  verifying: boolean;
  onSubmit: (code: string) => void;
  onDismiss: () => void;
  onResend: () => void;
  resending: boolean;
}

export function StepUpModal({ isOpen, action, error, verifying, onSubmit, onDismiss, onResend, resending }: StepUpModalProps) {
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCode("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const label = ACTION_LABELS[action] ?? "this action";

  function handleCodeChange(value: string) {
    setCode(value.replace(/\D/g, "").slice(0, 6));
  }

  function handleSubmit() {
    if (code.length === 6) onSubmit(code);
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Security verification">
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={onDismiss} aria-label="Cancel">
          <X size={18} />
        </button>

        <div className={styles.iconWrap}>
          <ShieldAlert size={20} />
        </div>

        <h2 className={styles.title}>Security check</h2>
        <p className={styles.desc}>
          For your security, we&apos;ve sent a 6-digit code to your phone number.
          Enter it to confirm {label}.
        </p>

        <label className={styles.label}>Verification code</label>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="000000"
          className={styles.codeInput}
        />

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={verifying || code.length !== 6}
        >
          {verifying ? <Loader2 size={17} className={styles.spinner} /> : "Confirm"}
        </button>

        <button className={styles.resendBtn} onClick={onResend} disabled={resending} type="button">
          {resending ? "Sending…" : "Resend code"}
        </button>
      </div>
    </div>
  );
}
