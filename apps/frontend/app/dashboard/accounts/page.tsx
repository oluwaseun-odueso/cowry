"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { api, Account, ApiError } from "@/lib/api";
import styles from "./page.module.css";

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.accounts.list()
      .then(({ data }) => setAccounts(data.accounts))
      .catch(() => setError("Failed to load accounts."))
      .finally(() => setLoading(false));
  }, []);

  const hasCurrent = accounts.some((a) => a.accountType === "current");

  async function openCurrent() {
    setError("");
    setCreating(true);
    try {
      const { data } = await api.accounts.create({ type: "current" });
      setAccounts((prev) => [...prev, data.account]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to open account.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Your accounts</h1>
          <p className={styles.subtitle}>Savings, current, and everything in between.</p>
        </div>
        {!hasCurrent && !loading && (
          <button onClick={openCurrent} disabled={creating} className={styles.newBtn}>
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Open current account
          </button>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <div className={styles.grid}>
          {[1, 2].map((i) => <div key={i} className={`${styles.cardSkeleton} ${styles.skeleton}`} />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className={styles.emptyState}>
          <Image
            src="/images/illustrations/vault.svg"
            alt=""
            width={96}
            height={96}
            className={styles.emptyIllustration}
          />
          <p className={styles.emptyLabel}>No accounts yet</p>
          <p className={styles.emptySub}>Your savings account is being set up. Check back shortly.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {accounts.map((account) => (
            <Link key={account.id} href={`/dashboard/accounts/${account.id}`} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardTypeWrap}>
                  <span className={`${styles.badge} ${account.accountType === "savings" ? styles.badgeSavings : styles.badgeCurrent}`}>
                    {account.accountType}
                  </span>
                  <span className={`${styles.badge} ${account.status === "active" ? styles.badgeActive : styles.badgeSuspended}`}>
                    {account.status}
                  </span>
                </div>
                <ArrowRight size={16} className={styles.arrow} />
              </div>

              <div className={styles.balanceBlock}>
                <p className={styles.balanceLabel}>Available balance</p>
                <p className={styles.balance}>{fmt(account.balance, account.currency)}</p>
              </div>

              <div className={styles.cardBottom}>
                <div className={styles.accountNums}>
                  <div>
                    <p className={styles.accountNumberLabel}>Sort code</p>
                    <p className={styles.accountNumber}>
                      {(account.sortCode ?? "400001").replace(/(\d{2})(\d{2})(\d{2})/, "$1-$2-$3")}
                    </p>
                  </div>
                  <div>
                    <p className={styles.accountNumberLabel}>Account number</p>
                    <p className={styles.accountNumber}>{account.accountNumber}</p>
                  </div>
                </div>
                <p className={styles.cardDate}>
                  Since {new Date(account.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
