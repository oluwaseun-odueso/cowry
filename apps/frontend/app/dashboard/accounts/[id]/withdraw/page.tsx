"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, AlertTriangle } from "lucide-react";
import { api, Account } from "@/lib/api";
import styles from "./page.module.css";

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function currencySymbol(currency: string) {
  return { GBP: "£", USD: "$", EUR: "€" }[currency] ?? currency;
}

type Stage = "form" | "confirm" | "success";

export default function WithdrawPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [account, setAccount] = useState<Account | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const [stage, setStage] = useState<Stage>("form");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ reference: string; newBalance: number } | null>(null);

  useEffect(() => {
    api.accounts.get(id)
      .then(({ data }) => setAccount(data.account))
      .finally(() => setLoadingAccount(false));
  }, [id]);

  function handleReview(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed < 0.01) { setError("Enter a valid amount (min 0.01)."); return; }
    if (account && parsed > account.balance) {
      setError(`Insufficient funds. Your available balance is ${fmt(account.balance, account.currency)}.`);
      return;
    }
    setError("");
    setStage("confirm");
  }

  async function handleConfirm() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.accounts.withdraw(id, {
        amount: parseFloat(amount),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      setSuccess({ reference: data.transaction.reference, newBalance: data.account.balance });
      setStage("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Withdrawal failed. Please try again.");
      setStage("form");
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

  if (stage === "success" && success && account) {
    return (
      <div className={styles.page}>
        <Link href={`/dashboard/accounts/${id}`} className={styles.backLink}>
          <ArrowLeft size={15} /> Back to account
        </Link>
        <div className={styles.successCard}>
          <div className={styles.successIconWrap}><CheckCircle size={40} /></div>
          <h2 className={styles.successTitle}>Withdrawal successful</h2>
          <p className={styles.successSub}>Funds have been withdrawn from your account.</p>
          <div className={styles.successMeta}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Reference</span>
              <span className={styles.metaValue}>{success.reference}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Amount withdrawn</span>
              <span className={styles.metaValue}>{fmt(parseFloat(amount), account.currency)}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>New balance</span>
              <span className={styles.metaValue}>{fmt(success.newBalance, account.currency)}</span>
            </div>
          </div>
          <Link href={`/dashboard/accounts/${id}`} className={styles.doneBtn}>View account</Link>
        </div>
      </div>
    );
  }

  if (stage === "confirm" && account) {
    return (
      <div className={styles.page}>
        <button onClick={() => setStage("form")} className={styles.backLink}>
          <ArrowLeft size={15} /> Edit details
        </button>
        <div className={styles.confirmCard}>
          <div className={styles.confirmIconWrap}><AlertTriangle size={32} /></div>
          <h2 className={styles.confirmTitle}>Confirm withdrawal</h2>
          <p className={styles.confirmSub}>Please review the details before confirming.</p>
          <div className={styles.confirmMeta}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>From account</span>
              <span className={styles.metaValue}>••••{account.accountNumber.slice(-4)}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Amount</span>
              <span className={`${styles.metaValue} ${styles.metaAmount}`}>
                {fmt(parseFloat(amount), account.currency)}
              </span>
            </div>
            {description.trim() && (
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Description</span>
                <span className={styles.metaValue}>{description.trim()}</span>
              </div>
            )}
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Balance after</span>
              <span className={styles.metaValue}>
                {fmt(account.balance - parseFloat(amount), account.currency)}
              </span>
            </div>
          </div>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <div className={styles.confirmActions}>
            <button onClick={() => setStage("form")} className={styles.cancelBtn} disabled={loading}>
              Cancel
            </button>
            <button onClick={handleConfirm} className={styles.confirmBtn} disabled={loading}>
              {loading ? "Processing…" : "Confirm withdrawal"}
            </button>
          </div>
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
            <p className={styles.summaryLabel}>Available balance</p>
            <p className={`${styles.summaryValue} ${styles.summaryBalance}`}>
              {fmt(account.balance, account.currency)}
            </p>
          </div>
          <div className={styles.summaryDivider} />
          <div className={styles.summaryItem}>
            <p className={styles.summaryLabel}>Account type</p>
            <p className={styles.summaryValue} style={{ textTransform: "capitalize" }}>{account.accountType}</p>
          </div>
        </div>
      )}

      <div className={styles.formCard}>
        <h1 className={styles.formTitle}>Withdraw funds</h1>
        <p className={styles.formSub}>Withdraw money from your {account?.accountType ?? ""} account.</p>

        <form onSubmit={handleReview} className={styles.form}>
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
                onChange={(e) => { setAmount(e.target.value); setError(""); }}
                className={styles.amountInput}
                placeholder="0.00"
                required
              />
            </div>
            {account && (
              <p className={styles.balanceHint}>
                Max: {fmt(account.balance, account.currency)}
              </p>
            )}
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
              placeholder="e.g. Rent payment"
              maxLength={200}
            />
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <button type="submit" className={styles.submitBtn}>
            Review withdrawal
          </button>
        </form>
      </div>
    </div>
  );
}
