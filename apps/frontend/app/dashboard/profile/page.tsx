"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CheckCircle, XCircle, Shield } from "lucide-react";
import { api, PublicUser } from "@/lib/api";
import styles from "./page.module.css";

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function fmtDateTime(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function ProfilePage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.auth.getProfile()
      .then(({ data }) => setUser(data.user))
      .catch(() => setError("Failed to load profile."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.shimHeader} />
        <div className={styles.shimCard} />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className={styles.page}>
        <p className={styles.errorMsg}>{error || "Profile not found."}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Profile</h1>
          <p className={styles.subtitle}>Your personal account information.</p>
        </div>
      </div>

      {/* Avatar + name hero */}
      <div className={styles.heroCard}>
        {user.avatar ? (
          <Image
            src={`/images/avatars/${user.avatar}.svg`}
            alt="Your avatar"
            width={80}
            height={80}
            className={styles.avatarImg}
          />
        ) : (
          <div className={styles.avatar}>{initials(user.firstName, user.lastName)}</div>
        )}
        <div className={styles.heroInfo}>
          <h2 className={styles.heroName}>{user.firstName} {user.lastName}</h2>
          <p className={styles.heroEmail}>{user.email}</p>
          <div className={styles.heroBadges}>
            <span className={`${styles.badge} ${user.role === "admin" ? styles.badgeAdmin : styles.badgeUser}`}>
              {user.role}
            </span>
            <span className={`${styles.badge} ${user.status === "active" ? styles.badgeActive : styles.badgeSuspended}`}>
              {user.status}
            </span>
          </div>
        </div>
      </div>

      {/* Details card */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Account details</h3>
        <div className={styles.rows}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>First name</span>
            <span className={styles.rowValue}>{user.firstName}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Last name</span>
            <span className={styles.rowValue}>{user.lastName}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Email</span>
            <span className={styles.rowValue}>{user.email}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Phone number</span>
            <span className={styles.rowValue}>{user.phoneNumber ?? "—"}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Member since</span>
            <span className={styles.rowValue}>{fmtDate(user.createdAt)}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Last login</span>
            <span className={styles.rowValue}>{fmtDateTime(user.lastLogin)}</span>
          </div>
        </div>
      </div>

      {/* Security status card */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Security status</h3>
        <div className={styles.rows}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Email verified</span>
            <span className={styles.rowValue}>
              {user.emailVerified
                ? <span className={styles.statusOk}><CheckCircle size={15} /> Verified</span>
                : <span className={styles.statusBad}><XCircle size={15} /> Not verified</span>}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Two-factor auth</span>
            <span className={styles.rowValue}>
              {user.isMfaEnabled
                ? <span className={styles.statusOk}><Shield size={15} /> Enabled</span>
                : <span className={styles.statusWarn}><Shield size={15} /> Disabled</span>}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
