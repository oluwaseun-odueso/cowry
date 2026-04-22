"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import { api, Account, Transaction, Pagination } from "@/lib/api";
import styles from "./page.module.css";

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

type Tab = "transactions" | "statement";

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [account, setAccount] = useState<Account | null>(null);
  const [tab, setTab] = useState<Tab>("transactions");

  // Transactions tab
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [txType, setTxType] = useState<"" | "credit" | "debit">("");
  const [txFrom, setTxFrom] = useState("");
  const [txTo, setTxTo] = useState("");
  const [txLoading, setTxLoading] = useState(false);

  // Statement tab
  const [stmtFrom, setStmtFrom] = useState("");
  const [stmtTo, setStmtTo] = useState("");
  const [stmtData, setStmtData] = useState<Record<string, unknown> | null>(null);
  const [stmtLoading, setStmtLoading] = useState(false);
  const [stmtError, setStmtError] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.accounts.get(id)
      .then(({ data }) => setAccount(data.account))
      .catch(() => setError("Account not found."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!account) return;
    setTxLoading(true);
    api.accounts.transactions(id, {
      page: txPage,
      limit: 10,
      ...(txType ? { type: txType } : {}),
      ...(txFrom ? { from: txFrom } : {}),
      ...(txTo ? { to: txTo } : {}),
    })
      .then(({ data }) => { setTxs(data.transactions); setPagination(data.pagination); })
      .catch(() => {})
      .finally(() => setTxLoading(false));
  }, [account, id, txPage, txType, txFrom, txTo]);

  async function generateStatement() {
    if (!stmtFrom || !stmtTo) { setStmtError("Please select both dates."); return; }
    setStmtError(""); setStmtLoading(true);
    try {
      const res = await api.accounts.statement(id, stmtFrom, stmtTo);
      setStmtData(res.data as Record<string, unknown>);
    } catch {
      setStmtError("Failed to generate statement.");
    } finally {
      setStmtLoading(false);
    }
  }

  if (loading) return <div className={styles.loadingShim} />;
  if (error || !account) return (
    <div className={styles.errorState}>
      <p>{error || "Account not found."}</p>
      <Link href="/dashboard/accounts" className={styles.backLink}><ArrowLeft size={15} /> Back to accounts</Link>
    </div>
  );

  return (
    <div className={styles.page}>
      {/* Back */}
      <Link href="/dashboard/accounts" className={styles.backLink}>
        <ArrowLeft size={15} /> Accounts
      </Link>

      {/* Account header card */}
      <div className={styles.accountCard}>
        <div className={styles.accountCardTop}>
          <div className={styles.accountMeta}>
            <span className={`${styles.badge} ${account.accountType === "savings" ? styles.badgeSavings : styles.badgeCurrent}`}>
              {account.accountType}
            </span>
            <span className={`${styles.badge} ${account.status === "active" ? styles.badgeActive : styles.badgeSuspended}`}>
              {account.status}
            </span>
          </div>
          <div className={styles.accountDetails}>
            <div>
              <p className={styles.accountNumLabel}>Account number</p>
              <p className={styles.accountNum}>{account.accountNumber}</p>
            </div>
            <div>
              <p className={styles.accountNumLabel}>Sort code</p>
              <p className={styles.accountNum}>{account.sortCode ? account.sortCode.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3') : '40-00-01'}</p>
            </div>
          </div>
        </div>
        <p className={styles.accountBalance}>{fmt(account.balance, account.currency)}</p>
        <p className={styles.accountCurrency}>{account.currency}</p>

        {/* Action buttons */}
        <div className={styles.actions}>
          <Link href={`/dashboard/accounts/${id}/deposit`} className={`${styles.actionBtn} ${styles.actionDeposit}`}>
            <ArrowDownLeft size={16} /> Deposit
          </Link>
          <Link href={`/dashboard/accounts/${id}/withdraw`} className={`${styles.actionBtn} ${styles.actionWithdraw}`}>
            <ArrowUpRight size={16} /> Withdraw
          </Link>
          <Link href={`/dashboard/accounts/${id}/transfer`} className={`${styles.actionBtn} ${styles.actionTransfer}`}>
            <RefreshCw size={16} /> Transfer
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "transactions" ? styles.tabActive : ""}`}
          onClick={() => setTab("transactions")}
        >
          Transactions
        </button>
        <button
          className={`${styles.tab} ${tab === "statement" ? styles.tabActive : ""}`}
          onClick={() => setTab("statement")}
        >
          Statement
        </button>
      </div>

      {/* Transactions tab */}
      {tab === "transactions" && (
        <div className={styles.tabContent}>
          {/* Filters */}
          <div className={styles.filters}>
            <select value={txType} onChange={(e) => { setTxType(e.target.value as "" | "credit" | "debit"); setTxPage(1); }} className={styles.filterSelect}>
              <option value="">All types</option>
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
            </select>
            <input type="date" value={txFrom} onChange={(e) => { setTxFrom(e.target.value); setTxPage(1); }} className={styles.filterInput} placeholder="From" />
            <input type="date" value={txTo} onChange={(e) => { setTxTo(e.target.value); setTxPage(1); }} className={styles.filterInput} placeholder="To" />
          </div>

          <div className={styles.txList}>
            {txLoading ? (
              [1,2,3,4].map((i) => <div key={i} className={`${styles.txSkeleton} ${styles.skeleton}`} />)
            ) : txs.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyLabel}>No transactions</p>
                <p className={styles.emptySub}>Try adjusting your filters.</p>
              </div>
            ) : (
              txs.map((tx) => (
                <Link key={tx.id} href={`/dashboard/transactions/${tx.id}`} className={styles.txRow}>
                  <div className={`${styles.txIcon} ${tx.type === "credit" ? styles.iconTrust : styles.iconPeach}`}>
                    {tx.type === "credit" ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                  </div>
                  <div className={styles.txInfo}>
                    <p className={styles.txRef}>{tx.reference}</p>
                    {tx.description && <p className={styles.txDesc}>{tx.description}</p>}
                    <p className={styles.txDate}>{fmtDate(tx.createdAt)}</p>
                  </div>
                  <div className={styles.txRight}>
                    <p className={`${styles.txAmount} ${tx.type === "credit" ? styles.txCredit : styles.txDebit}`}>
                      {tx.type === "credit" ? "+" : "−"}{fmt(tx.amount, account.currency)}
                    </p>
                    <span className={`${styles.statusBadge} ${tx.status === "completed" ? styles.statusCompleted : tx.status === "failed" ? styles.statusFailed : styles.statusPending}`}>
                      {tx.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className={styles.pagination}>
              <button disabled={txPage <= 1} onClick={() => setTxPage((p) => p - 1)} className={styles.pageBtn}>← Prev</button>
              <span className={styles.pageInfo}>Page {txPage} of {pagination.pages}</span>
              <button disabled={txPage >= pagination.pages} onClick={() => setTxPage((p) => p + 1)} className={styles.pageBtn}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* Statement tab */}
      {tab === "statement" && (
        <div className={styles.tabContent}>
          <div className={styles.stmtFilters}>
            <div className={styles.stmtField}>
              <label className={styles.stmtLabel}>From</label>
              <input type="date" value={stmtFrom} onChange={(e) => setStmtFrom(e.target.value)} className={styles.filterInput} />
            </div>
            <div className={styles.stmtField}>
              <label className={styles.stmtLabel}>To</label>
              <input type="date" value={stmtTo} onChange={(e) => setStmtTo(e.target.value)} className={styles.filterInput} />
            </div>
            <button onClick={generateStatement} disabled={stmtLoading} className={styles.stmtBtn}>
              {stmtLoading ? "Generating…" : "Generate"}
            </button>
          </div>
          {stmtError && <p className={styles.stmtError}>{stmtError}</p>}
          {stmtData && (
            <pre className={styles.stmtOutput}>{JSON.stringify(stmtData, null, 2)}</pre>
          )}
          {!stmtData && !stmtError && (
            <p className={styles.stmtHint}>Select a date range and click Generate to view your statement.</p>
          )}
        </div>
      )}
    </div>
  );
}
