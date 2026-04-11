"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { CowryLogo } from "@/components/cowry-logo";
import { api, ApiError } from "@/lib/api";
import styles from "./page.module.css";

type Status = "verifying" | "success" | "error";

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = use(searchParams);
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found. Click the link in your email again.");
      return;
    }
    api.auth
      .verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof ApiError ? err.message : "Verification failed — the link may have expired.");
      });
  }, [token]);

  const stateContent = {
    verifying: {
      ring: styles.ringPending,
      icon: <Loader2 size={26} className={styles.spinner} />,
      title: "Verifying…",
      text: "Hang tight, this only takes a moment.",
      cta: null,
    },
    success: {
      ring: styles.ringSuccess,
      icon: <CheckCircle2 size={26} />,
      title: "Email verified!",
      text: "You're all set. Start banking with Cowry.",
      cta: <Link href="/login" className={styles.btn}>Sign in</Link>,
    },
    error: {
      ring: styles.ringError,
      icon: <XCircle size={26} />,
      title: "Verification failed",
      text: message,
      cta: <Link href="/login" className={styles.btn}>Back to sign in</Link>,
    },
  }[status];

  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <CowryLogo />
        <span className={styles.accent} />
      </div>
      <div className={styles.state}>
        <div className={stateContent.ring}>{stateContent.icon}</div>
        <p className={styles.stateTitle}>{stateContent.title}</p>
        <p className={styles.stateText}>{stateContent.text}</p>
        {stateContent.cta}
      </div>
    </div>
  );
}
