"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { CowryLogo } from "@/components/cowry-logo";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
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
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState(INITIAL);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key: FieldKey, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const strength = strengthScore(form.password);

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const res = await api.auth.register(form);

      if (res.data.accessToken) {
        localStorage.setItem("accessToken", res.data.accessToken);

        try {
          await api.accounts.create({ type: "savings" });
        } catch (accountErr) {
          console.error("Auto account creation failed:", accountErr);
        }

        login(
          { accessToken: res.data.accessToken, refreshToken: res.data.refreshToken ?? "" },
          res.data.user,
        );
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
        <h1 className={styles.title}>Create your account.</h1>
        <p className={styles.subtitle}>Join Cowry — no paperwork, no branches.</p>
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

      <p className={styles.footer}>
        Already have an account?{" "}
        <Link href="/login" className={styles.footerLink}>Sign in</Link>
      </p>
    </div>
  );
}
