"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import styles from "./page.module.css";

export default function VerifyMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token: challengeToken } = use(searchParams);
  const router = useRouter();
  const { login } = useAuth();

  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!challengeToken) {
      setError("Missing challenge token. Please log in again.");
      return;
    }
    const finalCode = code.trim() || backupCode.trim();
    if (!finalCode) {
      setError("Please enter your authenticator code or a backup code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api.auth.verifyMfa({ challengeToken, code: finalCode });
      if (res.data.accessToken) {
        login(
          { accessToken: res.data.accessToken, refreshToken: res.data.refreshToken ?? "" },
          res.data.user,
        );
        router.push(res.data.user.isMfaEnabled ? "/dashboard" : "/setup-mfa");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleCodeChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.logo}>
        <span className={styles.logoMark}>Cowry</span>
      </div>

      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <ShieldCheck size={22} />
        </div>
        <h1 className={styles.cardTitle}>Two-factor authentication</h1>
        <p className={styles.cardDesc}>
          Enter the 6-digit code from your authenticator app, or use a backup code.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
          className={styles.form}
        >
          <div>
            <label className={styles.label}>Authenticator code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="000000"
              className={styles.codeInput}
            />
          </div>

          <div className={styles.divider}>or use backup code</div>

          <div>
            <label className={styles.label}>Backup code</label>
            <input
              type="text"
              autoComplete="off"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value)}
              placeholder="xxxxxxxx-xxxx"
              className={styles.backupInput}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Verify"}
          </button>
        </form>
      </div>

      <Link href="/login" className={styles.backLink}>
        <ArrowLeft size={15} />
        Back to sign in
      </Link>
    </div>
  );
}
