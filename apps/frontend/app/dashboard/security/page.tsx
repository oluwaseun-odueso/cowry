"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Check, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import styles from "./page.module.css";

/* ─────────────────────────────────────────────
   Change Password section
───────────────────────────────────────────── */
function ChangePasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) { setError("New passwords do not match."); return; }
    if (next.length < 8) { setError("New password must be at least 8 characters."); return; }
    setError(""); setLoading(true);
    try {
      await api.auth.changePassword({ currentPassword: current, newPassword: next });
      setSuccess(true);
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Change password</h2>
        <p className={styles.sectionSub}>Update your login password.</p>
      </div>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Current password</label>
          <div className={styles.pwWrap}>
            <input
              type={showCurrent ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={styles.input}
              placeholder="Enter current password"
              required
            />
            <button type="button" className={styles.eyeBtn} onClick={() => setShowCurrent((v) => !v)}>
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>New password</label>
          <div className={styles.pwWrap}>
            <input
              type={showNext ? "text" : "password"}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={styles.input}
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
            <button type="button" className={styles.eyeBtn} onClick={() => setShowNext((v) => !v)}>
              {showNext ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Confirm new password</label>
          <div className={styles.pwWrap}>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={styles.input}
              placeholder="Repeat new password"
              required
            />
          </div>
        </div>
        {error && <p className={styles.errorMsg}>{error}</p>}
        {success && <p className={styles.successMsg}>Password changed successfully.</p>}
        <button type="submit" disabled={loading} className={styles.primaryBtn}>
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </section>
  );
}

/* ─────────────────────────────────────────────
   MFA section
───────────────────────────────────────────── */
function MfaSection({ isMfaEnabled }: { isMfaEnabled: boolean }) {
  const [enabled, setEnabled] = useState(isMfaEnabled);
  const [step, setStep] = useState<"idle" | "setup" | "backupCodes">("idle");
  const [qrUrl, setQrUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Disable MFA
  const [disableCode, setDisableCode] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  async function startSetup() {
    setLoading(true); setError("");
    try {
      const { data } = await api.auth.setupMfa();
      setQrUrl(data.otpauthUrl);
      setSecret(data.secret);
      setStep("setup");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start MFA setup.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndEnable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const { data } = await api.auth.enableMfa(code);
      setBackupCodes(data.backupCodes ?? []);
      setEnabled(true);
      setStep("backupCodes");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setDisableLoading(true); setDisableError("");
    try {
      await api.auth.disableMfa(disableCode);
      setEnabled(false);
      setShowDisable(false);
      setDisableCode("");
    } catch (err: unknown) {
      setDisableError(err instanceof Error ? err.message : "Invalid code.");
    } finally {
      setDisableLoading(false);
    }
  }

  function copyAll() {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (step === "backupCodes") {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Two-factor authentication</h2>
          <p className={styles.sectionSub}>MFA is now active on your account.</p>
        </div>
        <div className={styles.backupWarning}>
          <Shield size={18} />
          <strong>Save your backup codes now.</strong> These are shown once and cannot be retrieved again.
        </div>
        <div className={styles.backupGrid}>
          {backupCodes.map((c) => <code key={c} className={styles.backupCode}>{c}</code>)}
        </div>
        <button onClick={copyAll} className={styles.ghostBtn}>
          {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy all codes</>}
        </button>
        <button onClick={() => setStep("idle")} className={styles.primaryBtn} style={{ marginTop: "0.5rem" }}>
          Done — I&apos;ve saved my codes
        </button>
      </section>
    );
  }

  if (step === "setup") {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Set up two-factor authentication</h2>
          <p className={styles.sectionSub}>Scan the QR code with your authenticator app (e.g. Google Authenticator).</p>
        </div>
        {qrUrl && (
          <div className={styles.qrWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="MFA QR code" className={styles.qrImg} />
          </div>
        )}
        {secret && (
          <div className={styles.secretBox}>
            <span className={styles.secretLabel}>Manual entry key</span>
            <code className={styles.secretCode}>{secret}</code>
          </div>
        )}
        <form onSubmit={verifyAndEnable} className={styles.form} style={{ marginTop: "1rem" }}>
          <div className={styles.field}>
            <label className={styles.label}>Verification code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={styles.input}
              placeholder="6-digit code"
              required
            />
          </div>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <div className={styles.rowBtns}>
            <button type="button" onClick={() => setStep("idle")} className={styles.ghostBtn} disabled={loading}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className={styles.primaryBtn}>
              {loading ? "Verifying…" : "Enable MFA"}
            </button>
          </div>
        </form>
      </section>
    );
  }

  // Idle state
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Two-factor authentication</h2>
        <p className={styles.sectionSub}>
          {enabled ? "Your account is protected with MFA." : "Add an extra layer of security to your account."}
        </p>
      </div>

      {enabled ? (
        <>
          <div className={styles.mfaStatusOn}>
            <Shield size={16} /> MFA is enabled
          </div>
          {!showDisable ? (
            <button onClick={() => setShowDisable(true)} className={styles.dangerGhostBtn}>
              Disable MFA
            </button>
          ) : (
            <form onSubmit={handleDisable} className={styles.form}>
              <p className={styles.disableWarning}>
                Enter your current TOTP code or a backup code to disable MFA.
              </p>
              <div className={styles.field}>
                <label className={styles.label}>Code</label>
                <input
                  type="text"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  className={styles.input}
                  placeholder="6-digit TOTP or backup code"
                  required
                />
              </div>
              {disableError && <p className={styles.errorMsg}>{disableError}</p>}
              <div className={styles.rowBtns}>
                <button type="button" onClick={() => setShowDisable(false)} className={styles.ghostBtn}>
                  Cancel
                </button>
                <button type="submit" disabled={disableLoading} className={styles.dangerBtn}>
                  {disableLoading ? "Disabling…" : "Disable MFA"}
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <button onClick={startSetup} disabled={loading} className={styles.primaryBtn}>
            {loading ? "Setting up…" : "Set up MFA"}
          </button>
        </>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────
   Page root
───────────────────────────────────────────── */
export default function SecurityPage() {
  const { user } = useAuth();

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Security</h1>
        <p className={styles.pageSub}>Manage your password and two-factor authentication.</p>
      </div>

      <ChangePasswordSection />
      <MfaSection isMfaEnabled={user?.isMfaEnabled ?? false} />
    </div>
  );
}
