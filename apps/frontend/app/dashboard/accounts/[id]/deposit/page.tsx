"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { api, Account } from "@/lib/api";
import styles from "./page.module.css";

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function currencySymbol(currency: string) {
  return { GBP: "£", USD: "$", EUR: "€" }[currency] ?? currency;
}

export default function DepositPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [account, setAccount] = useState<Account | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [success, setSuccess] = useState<{ reference: string; newBalance: number } | null>(null);

  useEffect(() => {
    api.accounts.get(id)
      .then(({ data }) => setAccount(data.account))
      .finally(() => setLoadingAccount(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed < 0.01) { setError("Enter a valid amount (min £0.01)."); return; }

    setError(""); setLoading(true);
    try {
      const { data } = await api.accounts.deposit(id, {
        amount: parsed,
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      setSuccess({ reference: data.transaction.reference, newBalance: data.balance });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Deposit failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (loadingAccount) {
    return (
      <div className={styles.page}>
        <div className={styles.shimBack} />
        <div className={styles.shimCard} />
      </div>
    );
  }

  if (success && account) {
    return (
      <div className={styles.page}>
        <Link href={`/dashboard/accounts/${id}`} className={styles.backLink}>
          <ArrowLeft size={15} /> Back to account
        </Link>
        <div className={styles.successCard}>
          <div className={styles.successIconWrap}><CheckCircle size={40} /></div>
          <h2 className={styles.successTitle}>Deposit successful</h2>
          <p className={styles.successSub}>Your funds have been added to your account.</p>
          <div className={styles.successMeta}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Reference</span>
              <span className={styles.metaValue}>{success.reference}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>New balance</span>
              <span className={styles.metaValue}>{fmt(success.newBalance, account.currency)}</span>
            </div>
          </div>
          <Link href={`/dashboard/accounts/${id}`} className={styles.doneBtn}>
            View account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href={`/dashboard/accounts/${id}`} className={styles.backLink}>
        <ArrowLeft size={15} /> Back to account
      </Link>

      {account && (
        <div className={styles.accountSummary}>
          <div className={styles.summaryItem}>
            <p className={styles.summaryLabel}>Account</p>
            <p className={styles.summaryValue}>••••{account.accountNumber.slice(-4)}</p>
          </div>
          <div className={styles.summaryDivider} />
          <div className={styles.summaryItem}>
            <p className={styles.summaryLabel}>Current balance</p>
            <p className={styles.summaryValue}>{fmt(account.balance, account.currency)}</p>
          </div>
          <div className={styles.summaryDivider} />
          <div className={styles.summaryItem}>
            <p className={styles.summaryLabel}>Account type</p>
            <p className={styles.summaryValue} style={{ textTransform: "capitalize" }}>{account.accountType}</p>
          </div>
        </div>
      )}

      <div className={styles.formCard}>
        <h1 className={styles.formTitle}>Deposit funds</h1>
        <p className={styles.formSub}>Add money to your {account?.accountType ?? ""} account.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Amount</label>
            <div className={styles.amountWrap}>
              <span className={styles.currencySymbol}>
                {currencySymbol(account?.currency ?? "GBP")}
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={styles.amountInput}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Description <span className={styles.optional}>(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.input}
              placeholder="e.g. Monthly savings top-up"
              maxLength={200}
            />
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? "Processing…" : "Deposit funds"}
          </button>
        </form>
      </div>
    </div>
  );
}
