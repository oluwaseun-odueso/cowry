"use client";

import { useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { CowryLogo } from "@/components/cowry-logo";
import { api, ApiError } from "@/lib/api";
import styles from "./page.module.css";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = use(searchParams);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!token) { setError("Invalid or missing reset token."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setError("");
    setLoading(true);
    try {
      await api.auth.resetPassword({ token, password, confirmPassword: confirm });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className={styles.page}>
        <div className={styles.brand}>
          <CowryLogo />
          <span className={styles.accent} />
        </div>
        <div className={styles.success}>
          <div className={styles.successRing}>
            <CheckCircle2 size={28} />
          </div>
          <p className={styles.successTitle}>Password updated!</p>
          <p className={styles.successText}>
            Your password has been reset successfully. Sign in with your new credentials.
          </p>
          <Link href="/login" className={styles.loginBtn}>Go to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <CowryLogo />
        <span className={styles.accent} />
      </div>

      <div className={styles.heading}>
        <h1 className={styles.title}>New password.</h1>
        <p className={styles.subtitle}>Min. 8 chars with uppercase, number &amp; special character</p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
        className={styles.form}
      >
        <div className={styles.fieldGroup}>
          <label className={styles.label}>New password</label>
          <div className={styles.inputWrap}>
            <input type={showPw ? "text" : "password"} autoComplete="new-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" className={styles.inputWithIcon} />
            <button type="button" onClick={() => setShowPw((v) => !v)} className={styles.eyeBtn}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Confirm password</label>
          <div className={styles.inputWrap}>
            <input type={showConfirm ? "text" : "password"} autoComplete="new-password" required
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••" className={styles.inputWithIcon} />
            <button type="button" onClick={() => setShowConfirm((v) => !v)} className={styles.eyeBtn}>
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" disabled={loading || !token} className={styles.submitBtn}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : "Reset password"}
        </button>

        <Link href="/login" className={styles.backLink}>
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
