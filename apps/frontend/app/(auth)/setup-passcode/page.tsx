"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import styles from "./page.module.css";

export default function SetupPasscodePage() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [confirmDigits, setConfirmDigits] = useState<string[]>(Array(6).fill(""));
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleDigit(
    i: number,
    val: string,
    arr: string[],
    setArr: (v: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    isLast: boolean,
  ) {
    if (!/^\d?$/.test(val)) return;
    const next = [...arr];
    next[i] = val.slice(-1);
    setArr(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
    if (isLast && val && next.every(d => d)) {
      // auto-advance step
    }
  }

  function handleKeyDown(
    e: React.KeyboardEvent,
    i: number,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
  ) {
    if (e.key === "Backspace" && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function nextStep() {
    const code = digits.join("");
    if (code.length < 6) { setError("Enter all 6 digits."); return; }
    setError("");
    setStep("confirm");
    setTimeout(() => confirmRefs.current[0]?.focus(), 50);
  }

  async function savePasscode() {
    const code = digits.join("");
    const confirm = confirmDigits.join("");
    if (code !== confirm) {
      setError("Passcodes don't match. Try again.");
      setConfirmDigits(Array(6).fill(""));
      setTimeout(() => confirmRefs.current[0]?.focus(), 50);
      return;
    }
    setSaving(true);
    try {
      await api.auth.setPasscode(code);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const currentDigits = step === "enter" ? digits : confirmDigits;
  const setCurrentDigits = step === "enter" ? setDigits : setConfirmDigits;
  const currentRefs = step === "enter" ? inputRefs : confirmRefs;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.lockIcon}>🔐</div>
        <h1 className={styles.title}>
          {step === "enter" ? "Create a passcode" : "Confirm your passcode"}
        </h1>
        <p className={styles.subtitle}>
          {step === "enter"
            ? "You'll use this 6-digit code to unlock the app after inactivity."
            : "Re-enter your passcode to confirm it."}
        </p>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.pinRow}>
          {currentDigits.map((d, i) => (
            <input
              key={i}
              ref={el => { currentRefs.current[i] = el; }}
              className={`${styles.pinInput} ${d ? styles.pinFilled : ""}`}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              autoFocus={i === 0}
              onChange={e => handleDigit(i, e.target.value, currentDigits, setCurrentDigits, currentRefs, i === 5)}
              onKeyDown={e => handleKeyDown(e, i, currentRefs)}
            />
          ))}
        </div>

        <div className={styles.actions}>
          {step === "enter" ? (
            <button
              className={styles.primaryBtn}
              onClick={nextStep}
              disabled={digits.some(d => !d)}
            >
              Continue
            </button>
          ) : (
            <>
              <button
                className={styles.primaryBtn}
                onClick={() => void savePasscode()}
                disabled={saving || confirmDigits.some(d => !d)}
              >
                {saving ? "Setting up…" : "Set passcode"}
              </button>
              <button className={styles.ghostBtn} onClick={() => { setStep("enter"); setError(""); setConfirmDigits(Array(6).fill("")); }}>
                Back
              </button>
            </>
          )}
          <button className={styles.skipBtn} onClick={() => router.push("/dashboard")}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
