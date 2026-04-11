"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, PublicUser, FraudAlert, Pagination } from "@/lib/api";
import styles from "./page.module.css";

type Tab = "users" | "audit";

/* ─────────────────────────────────────────────
   Users tab
───────────────────────────────────────────── */
function UsersTab() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.admin.users()
      .then(({ data }) => setUsers(data.users))
      .catch(() => setError("Failed to load users."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={styles.tableWrap}>
        {[1, 2, 3].map((i) => <div key={i} className={`${styles.rowSkeleton} ${styles.skeleton}`} />)}
      </div>
    );
  }

  if (error) return <p className={styles.errorMsg}>{error}</p>;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Email verified</th>
            <th>MFA</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className={styles.tdName}>{u.firstName} {u.lastName}</td>
              <td className={styles.tdEmail}>{u.email}</td>
              <td>
                <span className={`${styles.badge} ${u.role === "admin" ? styles.badgeAdmin : styles.badgeUser}`}>
                  {u.role}
                </span>
              </td>
              <td>
                <span className={`${styles.badge} ${u.status === "active" ? styles.badgeActive : styles.badgeSuspended}`}>
                  {u.status}
                </span>
              </td>
              <td className={styles.tdCenter}>
                {u.emailVerified
                  ? <CheckCircle size={15} className={styles.iconOk} />
                  : <span className={styles.iconNo}>—</span>}
              </td>
              <td className={styles.tdCenter}>
                {u.isMfaEnabled
                  ? <CheckCircle size={15} className={styles.iconOk} />
                  : <span className={styles.iconNo}>—</span>}
              </td>
              <td className={styles.tdDate}>
                {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && <p className={styles.emptyMsg}>No users found.</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Audit log tab
───────────────────────────────────────────── */
const RISK_LABELS: Record<string, string> = { low: "LOW", medium: "MED", high: "HIGH" };

function AuditTab() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [riskLevel, setRiskLevel] = useState("");
  const [isResolved, setIsResolved] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.admin.auditLog({
      page,
      limit: 15,
      ...(riskLevel ? { riskLevel } : {}),
      ...(isResolved !== "" ? { isResolved } : {}),
    })
      .then(({ data }) => {
        setAlerts(data.alerts);
        setPagination(data.pagination);
      })
      .catch(() => setError("Failed to load audit log."))
      .finally(() => setLoading(false));
  }, [page, riskLevel, isResolved]);

  async function resolve(alertId: string) {
    setResolving(alertId);
    try {
      await api.admin.resolveAlert(alertId);
      setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, isResolved: true } : a));
    } catch {
      setError("Failed to resolve alert.");
    } finally {
      setResolving(null);
    }
  }

  return (
    <div className={styles.auditWrap}>
      {/* Filters */}
      <div className={styles.filters}>
        <select value={riskLevel} onChange={(e) => { setRiskLevel(e.target.value); setPage(1); }} className={styles.filterSelect}>
          <option value="">All risk levels</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select value={isResolved} onChange={(e) => { setIsResolved(e.target.value); setPage(1); }} className={styles.filterSelect}>
          <option value="">All statuses</option>
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
        </select>
      </div>

      {error && <p className={styles.errorMsg}>{error}</p>}

      <div className={styles.tableWrap}>
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className={`${styles.rowSkeleton} ${styles.skeleton}`} />)
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rule</th>
                <th>Risk</th>
                <th>Description</th>
                <th>IP</th>
                <th>Date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td className={styles.tdRule}>{alert.ruleName}</td>
                  <td>
                    <span className={`${styles.badge} ${
                      alert.riskLevel === "high"   ? styles.badgeHigh :
                      alert.riskLevel === "medium" ? styles.badgeMed  : styles.badgeLow
                    }`}>
                      {RISK_LABELS[alert.riskLevel] ?? alert.riskLevel}
                    </span>
                  </td>
                  <td className={styles.tdDesc}>{alert.description}</td>
                  <td className={styles.tdIp}>{alert.ipAddress}</td>
                  <td className={styles.tdDate}>
                    {new Date(alert.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${alert.isResolved ? styles.badgeActive : styles.badgeSuspended}`}>
                      {alert.isResolved ? "resolved" : "open"}
                    </span>
                  </td>
                  <td>
                    {!alert.isResolved && (
                      <button
                        onClick={() => resolve(alert.id)}
                        disabled={resolving === alert.id}
                        className={styles.resolveBtn}
                      >
                        {resolving === alert.id ? "…" : "Resolve"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && alerts.length === 0 && <p className={styles.emptyMsg}>No alerts found.</p>}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className={styles.pagination}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={styles.pageBtn}>← Prev</button>
          <span className={styles.pageInfo}>Page {page} of {pagination.pages}</span>
          <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className={styles.pageBtn}>Next →</button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Page root
───────────────────────────────────────────── */
export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("users");

  useEffect(() => {
    if (!isLoading && user && user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return <div className={styles.loadingShim} />;
  if (user.role !== "admin") return null;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <ShieldAlert size={22} className={styles.headerIcon} />
          <div>
            <h1 className={styles.pageTitle}>Admin</h1>
            <p className={styles.pageSub}>Manage users and review security alerts.</p>
          </div>
        </div>
        <span className={styles.adminBadge}>Admin only</span>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === "users" ? styles.tabActive : ""}`} onClick={() => setTab("users")}>
          Users
        </button>
        <button className={`${styles.tab} ${tab === "audit" ? styles.tabActive : ""}`} onClick={() => setTab("audit")}>
          Audit log
        </button>
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}
