"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { CowryLogo } from "@/components/cowry-logo";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<"generic" | "locked">("generic");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const res = await api.auth.login(form);
      if (res.data.mfaRequired && res.data.challengeToken) {
        router.push(`/verify-mfa?token=${encodeURIComponent(res.data.challengeToken)}`);
        return;
      }
      if (res.data.accessToken) {
        login({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken ?? "", expiresIn: res.data.expiresIn }, res.data.user);
        router.push(res.data.user.isMfaEnabled ? "/dashboard" : "/setup-mfa");
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      setErrorType(msg.toLowerCase().includes("locked") ? "locked" : "generic");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <CowryLogo />
        <span className={styles.accent} />
      </div>

      <div className={styles.heading}>
        <h1 className={styles.title}>Welcome back.</h1>
        <p className={styles.subtitle}>Your vault is waiting. Sign in to access your account.</p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
        className={styles.form}
      >
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Email</label>
          <input
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="you@example.com"
            className={styles.input}
          />
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.labelRow}>
            <label className={styles.label}>Password</label>
            <Link href="/forgot-password" className={styles.forgotLink}>Forgot password?</Link>
          </div>
          <div className={styles.inputWrap}>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              className={styles.inputWithIcon}
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className={styles.eyeBtn}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && errorType === "locked" ? (
          <div className={styles.lockedBanner}>
            <Lock size={16} />
            <div>
              <strong>Account temporarily locked</strong>
              <p>{error}</p>
            </div>
          </div>
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : null}

        <div className={styles.actions}>
          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Sign in"}
          </button>
        </div>
      </form>

      <div className={styles.divider}>
        <span className={styles.dividerLine} />
        <span className={styles.dividerText}>or</span>
        <span className={styles.dividerLine} />
      </div>

      <a
        href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`}
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
      </a>

      <p className={styles.footer}>
        No account yet?{" "}
        <Link href="/register" className={styles.footerLink}>Create one</Link>
      </p>
    </div>
  );
}
