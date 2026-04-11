"use client";

import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import styles from "./page.module.css";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const SUMMARY_CARDS = [
  { label: "Total balance", value: "—", icon: Wallet, accent: "#1873B9" },
  { label: "Money in", value: "—", icon: ArrowDownLeft, accent: "#08E8DE" },
  { label: "Money out", value: "—", icon: ArrowUpRight, accent: "#093980" },
];

const PLACEHOLDER_ACTIVITY = [
  { label: "No transactions yet", sub: "Your activity will appear here once you start transacting." },
];

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className={styles.page}>
      <div className={styles.greetingBlock}>
        <h1 className={styles.greeting}>
          {greeting()}, {user?.firstName ?? "there"}.
        </h1>
        <p className={styles.greetingSub}>Here&rsquo;s an overview of your account.</p>
      </div>

      <div className={styles.cards}>
        {SUMMARY_CARDS.map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className={styles.card}>
            <div className={styles.cardIcon} style={{ background: `${accent}18`, color: accent }}>
              <Icon size={18} />
            </div>
            <div>
              <p className={styles.cardLabel}>{label}</p>
              <p className={styles.cardValue}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent activity</h2>
        <div className={styles.activityList}>
          {PLACEHOLDER_ACTIVITY.map(({ label, sub }) => (
            <div key={label} className={styles.emptyState}>
              <p className={styles.emptyLabel}>{label}</p>
              <p className={styles.emptySub}>{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
