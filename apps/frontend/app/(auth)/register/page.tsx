"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import { CowryLogo } from "@/components/cowry-logo";
import { api, ApiError } from "@/lib/api";
import styles from "./page.module.css";

const INITIAL = { firstName: "", lastName: "", email: "", phoneNumber: "", password: "" };
type FieldKey = keyof typeof INITIAL;

const STRENGTH_COLORS = ["#dc2626", "#d97706", "#0891b2", "#059669"];
const STRENGTH_LABELS = ["Weak", "Fair", "Good", "Strong"];

function strengthScore(pw: string): number {
  if (pw.length === 0) return -1;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(3, score - (score === 4 ? 0 : 0));
}

export default function RegisterPage() {
  const [form, setForm] = useState(INITIAL);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [googlePhone, setGooglePhone] = useState("");
  const [showGooglePrompt, setShowGooglePrompt] = useState(false);

  function handleGoogleSignUp() {
    if (!googlePhone.trim()) return;
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";
    window.location.href = `${base}/auth/google?phoneNumber=${encodeURIComponent(googlePhone.trim())}`;
  }

  const set = (key: FieldKey, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const strength = strengthScore(form.password);

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      await api.auth.register(form);
      setRegisteredEmail(form.email);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (registeredEmail) {
    return (
      <div className={styles.page}>
        <div className={styles.brand}>
          <CowryLogo />
        </div>
        <div className={styles.successWrap}>
          <div className={styles.successIcon}><MailCheck size={32} /></div>
          <h1 className={styles.title}>Check your inbox</h1>
          <p className={styles.subtitle}>
            We sent a verification link to <strong>{registeredEmail}</strong>. Click it to activate your account, then come back to sign in.
          </p>
          <p className={styles.footer}>
            Already verified?{" "}
            <Link href="/login" className={styles.footerLink}>Sign in</Link>
          </p>
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
        <h1 className={styles.title}>Create your account.</h1>
        <p className={styles.subtitle}>Join Cowry, no paperwork, no branches.</p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
        className={styles.form}
      >
        <div className={styles.row}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>First name</label>
            <input type="text" autoComplete="given-name" required value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)} placeholder="Ada" className={styles.input} />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Last name</label>
            <input type="text" autoComplete="family-name" required value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)} placeholder="Lovelace" className={styles.input} />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Email</label>
          <input type="email" autoComplete="email" required value={form.email}
            onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" className={styles.input} />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Phone number</label>
          <input type="tel" autoComplete="tel" required value={form.phoneNumber}
            onChange={(e) => set("phoneNumber", e.target.value)} placeholder="+234 800 000 0000" className={styles.input} />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Password</label>
          <div className={styles.inputWrap}>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="Min. 8 characters"
              className={styles.inputWithIcon}
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className={styles.eyeBtn}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {/* Strength bar */}
          {form.password.length > 0 && (
            <div className={styles.strengthRow}>
              <div className={styles.strengthBar}>
                <div
                  className={styles.strengthFill}
                  style={{
                    width: `${(strength + 1) * 25}%`,
                    background: STRENGTH_COLORS[strength],
                  }}
                />
              </div>
              <span className={styles.strengthLabel} style={{ color: STRENGTH_COLORS[strength] }}>
                {STRENGTH_LABELS[strength]}
              </span>
            </div>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" disabled={loading} className={styles.submitBtn}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : "Create account"}
        </button>
      </form>

      <div className={styles.divider}>
        <span className={styles.dividerLine} />
        <span className={styles.dividerText}>or</span>
        <span className={styles.dividerLine} />
      </div>

      {showGooglePrompt ? (
        <div className={styles.googlePrompt}>
          <p className={styles.googlePromptLabel}>Enter your phone number to continue with Google</p>
          <input
            type="tel"
            value={googlePhone}
            onChange={(e) => setGooglePhone(e.target.value)}
            placeholder="+234 800 000 0000"
            className={styles.input}
            autoFocus
          />
          <div className={styles.googlePromptActions}>
            <button type="button" onClick={() => setShowGooglePrompt(false)} className={styles.cancelBtn}>
              Cancel
            </button>
            <button type="button" onClick={handleGoogleSignUp} disabled={!googlePhone.trim()} className={styles.googleConfirmBtn}>
              Continue
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowGooglePrompt(true)}
          className={styles.googleBtn}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          Continue with Google
        </button>
      )}

      <p className={styles.footer}>
        Already have an account?{" "}
        <Link href="/login" className={styles.footerLink}>Sign in</Link>
      </p>
    </div>
  );
}
