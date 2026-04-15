"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight } from "lucide-react";
import { api, Transaction } from "@/lib/api";
import styles from "./page.module.css";

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.transactions.get(id)
      .then(({ data }) => setTx(data.transaction))
      .catch(() => setError("Transaction not found."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.shimBack} />
        <div className={styles.shimReceipt} />
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className={styles.page}>
        <Link href="/dashboard/accounts" className={styles.backLink}>
          <ArrowLeft size={15} /> Back to accounts
        </Link>
        <div className={styles.errorState}>
          <p>{error || "Transaction not found."}</p>
        </div>
      </div>
    );
  }

  const isCredit = tx.type === "credit";
  const currency = "GBP"; // fallback; ideally passed via query or stored on tx

  return (
    <div className={styles.page}>
      <Link href={`/dashboard/accounts/${tx.accountId}`} className={styles.backLink}>
        <ArrowLeft size={15} /> Back to account
      </Link>

      <div className={styles.receipt}>
        {/* Amount hero */}
        <div className={styles.receiptHero}>
          <div className={`${styles.typeIcon} ${isCredit ? styles.iconCredit : styles.iconDebit}`}>
            {isCredit ? <ArrowDownLeft size={28} /> : <ArrowUpRight size={28} />}
          </div>
          <p className={`${styles.amountHero} ${isCredit ? styles.amountCredit : styles.amountDebit}`}>
            {isCredit ? "+" : "−"}{fmt(tx.amount, currency)}
          </p>
          <div className={styles.badgeRow}>
            <span className={`${styles.typeBadge} ${isCredit ? styles.typeCredit : styles.typeDebit}`}>
              {tx.type}
            </span>
            <span className={`${styles.statusBadge} ${
              tx.status === "completed" ? styles.statusCompleted :
              tx.status === "failed"    ? styles.statusFailed    : styles.statusPending
            }`}>
              {tx.status}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className={styles.divider}>
          <div className={styles.dividerDot} />
          <div className={styles.dividerLine} />
          <div className={styles.dividerDot} />
        </div>

        {/* Details */}
        <div className={styles.details}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Reference</span>
            <span className={styles.detailValue}>{tx.reference}</span>
          </div>
          {tx.description && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Description</span>
              <span className={styles.detailValue}>{tx.description}</span>
            </div>
          )}
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Date & time</span>
            <span className={styles.detailValue}>{fmtDate(tx.createdAt)}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Account ID</span>
            <span className={`${styles.detailValue} ${styles.mono}`}>{tx.accountId}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Transaction ID</span>
            <span className={`${styles.detailValue} ${styles.mono}`}>{tx.id}</span>
          </div>
        </div>

        {/* Footer */}
        <p className={styles.receiptFooter}>Cowry Bank · Authorised transaction record</p>
      </div>
    </div>
  );
}
