"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
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
        <p className={styles.subtitle}>Sign in to your Cowry account</p>
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

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Sign in"}
          </button>
        </div>
      </form>

      <p className={styles.footer}>
        No account yet?{" "}
        <Link href="/register" className={styles.footerLink}>Create one</Link>
      </p>
    </div>
  );
}
