"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import styles from "./page.module.css";

export default function SetupMfaPage() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [step, setStep] = useState<"qr" | "verify" | "backup">("qr");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.auth
      .setupMfa()
      .then(({ data }) => {
        setOtpauthUrl(data.otpauthUrl);
        setSecret(data.secret);
      })
      .catch(() => setError("Failed to start MFA setup. Please try again."))
      .finally(() => setInitLoading(false));
  }, []);

  async function handleVerify() {
    if (code.length !== 6) {
      setError("Please enter the 6-digit code from your authenticator app.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api.auth.enableMfa(code);
      setBackupCodes(res.data.backupCodes);
      // Refresh profile so isMfaEnabled is updated in auth context
      const profile = await api.auth.getProfile();
      setUser(profile.data.user);
      // Create the default savings account now that MFA is enabled
      try {
        await api.accounts.create({ type: "savings" });
      } catch {
        // Account may already exist — ignore
      }
      setStep("backup");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function copySecret() {
    navigator.clipboard.writeText(secret).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCodeChange(value: string) {
    setCode(value.replace(/\D/g, "").slice(0, 6));
  }

  if (initLoading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loading}>
          <Loader2 size={28} className={styles.spinner} />
          <p>Setting up…</p>
        </div>
      </div>
    );
  }

  if (step === "backup") {
    return (
      <div className={styles.wrapper}>
        <div className={styles.iconWrap}>
          <ShieldCheck size={22} />
        </div>
        <h1 className={styles.title}>MFA enabled!</h1>
        <p className={styles.desc}>
          Save these backup codes somewhere safe. Each code can only be used once to recover your account if you lose access to your authenticator app.
        </p>
        <div className={styles.backupGrid}>
          {backupCodes.map((c) => (
            <span key={c} className={styles.backupCode}>{c}</span>
          ))}
        </div>
        <button
          className={styles.submitBtn}
          onClick={() => router.push("/setup-avatar")}
        >
          I&apos;ve saved my codes — continue
        </button>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.iconWrap}>
        <ShieldCheck size={22} />
      </div>
      <h1 className={styles.title}>Set up two-factor authentication</h1>
      <p className={styles.desc}>
        Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to confirm.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      {step === "qr" && (
        <>
          <div className={styles.qrWrap}>
            {otpauthUrl ? (
              <QRCodeSVG value={otpauthUrl} size={180} />
            ) : (
              <div className={styles.qrPlaceholder} />
            )}
          </div>

          <div className={styles.secretRow}>
            <span className={styles.secretLabel}>Can&apos;t scan?</span>
            <code className={styles.secretCode}>{secret}</code>
            <button className={styles.copyBtn} onClick={copySecret} type="button">
              <Copy size={13} />
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <button className={styles.submitBtn} onClick={() => setStep("verify")}>
            I&apos;ve scanned the code
          </button>
        </>
      )}

      {step === "verify" && (
        <>
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
            autoFocus
          />
          <div className={styles.btnRow}>
            <button
              className={styles.ghostBtn}
              onClick={() => { setStep("qr"); setError(""); }}
              type="button"
            >
              Back
            </button>
            <button
              className={styles.submitBtn}
              onClick={() => void handleVerify()}
              disabled={loading || code.length !== 6}
            >
              {loading ? <Loader2 size={18} className={styles.spinner} /> : "Verify & enable"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
