"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { CowryLogo } from "@/components/cowry-logo";
import { api, ApiError } from "@/lib/api";
import styles from "./page.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      await api.auth.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className={styles.page}>
        <div className={styles.brand}>
          <CowryLogo />
          <span className={styles.accent} />
        </div>
        <div className={styles.success}>
          <div className={styles.successRing}>
            <MailCheck size={28} />
          </div>
          <p className={styles.successTitle}>Email sent!</p>
          <p className={styles.successText}>
            We sent a reset link to{" "}
            <span className={styles.successEmail}>{email}</span>.
            Check your inbox — it expires in 15 minutes.
          </p>
          <Link href="/login" className={styles.backLink}>
            <ArrowLeft size={14} />
            Back to sign in
          </Link>
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
        <h1 className={styles.title}>Forgot password?</h1>
        <p className={styles.subtitle}>Enter your email and we&apos;ll send a reset link</p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
        className={styles.form}
      >
        <div>
          <label className={styles.label}>Email</label>
          <input type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={styles.input} />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" disabled={loading} className={styles.submitBtn}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : "Send reset link"}
        </button>

        <Link href="/login" className={styles.backLink}>
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
