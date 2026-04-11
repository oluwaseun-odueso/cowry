"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CreditCard } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, Account, Transaction } from "@/lib/api";
import styles from "./page.module.css";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface RecentTx extends Transaction { accountCurrency: string; }

export default function DashboardPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTxs, setRecentTxs] = useState<RecentTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.accounts.list();
        setAccounts(data.accounts);

        const txPromises = data.accounts.map((a) =>
          api.accounts.transactions(a.id, { limit: 5 })
            .then((r) => r.data.transactions.map((t) => ({ ...t, accountCurrency: a.currency })))
            .catch(() => [] as RecentTx[])
        );
        const all = (await Promise.all(txPromises)).flat();
        all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRecentTxs(all.slice(0, 5));
      } catch {
        // silently degrade — user sees empty state
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalCredit = recentTxs.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalDebit  = recentTxs.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const currency = accounts[0]?.currency ?? "GBP";

  return (
    <div className={styles.page}>
      {/* Greeting */}
      <div className={styles.greetingBlock}>
        <h1 className={styles.greeting}>{greeting()}, {user?.firstName ?? "there"}.</h1>
        <p className={styles.greetingSub}>Here&rsquo;s an overview of your finances.</p>
      </div>

      {/* Summary cards */}
      <div className={styles.cards}>
        {loading ? (
          [1,2,3].map((i) => <div key={i} className={`${styles.card} ${styles.skeleton}`} />)
        ) : (
          <>
            <div className={styles.card}>
              <div className={styles.cardIcon} style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
                <CreditCard size={18} />
              </div>
              <div>
                <p className={styles.cardLabel}>Total balance</p>
                <p className={styles.cardValue}>{accounts.length ? fmt(totalBalance, currency) : "—"}</p>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardIcon} style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
                <ArrowDownLeft size={18} />
              </div>
              <div>
                <p className={styles.cardLabel}>Money in (recent)</p>
                <p className={styles.cardValue}>{accounts.length ? fmt(totalCredit, currency) : "—"}</p>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardIcon} style={{ background: "#09398012", color: "var(--navy)" }}>
                <ArrowUpRight size={18} />
              </div>
              <div>
                <p className={styles.cardLabel}>Money out (recent)</p>
                <p className={styles.cardValue}>{accounts.length ? fmt(totalDebit, currency) : "—"}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick actions */}
      {!loading && accounts.length > 0 && (
        <div className={styles.quickLinks}>
          <Link href={`/dashboard/accounts/${accounts[0].id}/deposit`} className={styles.quickLink}>
            <ArrowDownLeft size={15} /> Deposit
          </Link>
          <Link href={`/dashboard/accounts/${accounts[0].id}/withdraw`} className={styles.quickLink}>
            <ArrowUpRight size={15} /> Withdraw
          </Link>
          <Link href={`/dashboard/accounts/${accounts[0].id}/transfer`} className={styles.quickLink}>
            <CreditCard size={15} /> Transfer
          </Link>
        </div>
      )}

      {/* Recent activity */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recent activity</h2>
          {accounts.length > 0 && (
            <Link href="/dashboard/accounts" className={styles.sectionLink}>View all →</Link>
          )}
        </div>
        <div className={styles.activityList}>
          {loading ? (
            [1,2,3].map((i) => <div key={i} className={`${styles.txRowSkeleton} ${styles.skeleton}`} />)
          ) : recentTxs.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyLabel}>No transactions yet</p>
              <p className={styles.emptySub}>Deposit or transfer to get started.</p>
            </div>
          ) : (
            recentTxs.map((tx) => (
              <Link key={tx.id} href={`/dashboard/transactions/${tx.id}`} className={styles.txRow}>
                <div
                  className={styles.txIcon}
                  style={tx.type === "credit"
                    ? { background: "var(--color-success-bg)", color: "var(--color-success)" }
                    : { background: "#09398012", color: "var(--navy)" }}
                >
                  {tx.type === "credit" ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                </div>
                <div className={styles.txInfo}>
                  <p className={styles.txRef}>{tx.reference}</p>
                  {tx.description && <p className={styles.txDesc}>{tx.description}</p>}
                </div>
                <div className={styles.txRight}>
                  <p className={styles.txAmount} style={{ color: tx.type === "credit" ? "var(--color-success)" : "var(--navy)" }}>
                    {tx.type === "credit" ? "+" : "−"}{fmt(tx.amount, tx.accountCurrency)}
                  </p>
                  <p className={styles.txTime}>{timeAgo(tx.createdAt)}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
