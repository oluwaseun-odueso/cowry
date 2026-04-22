"use client";

import { useEffect, useState } from "react";
import { Plus, X, CheckCircle, XCircle, Clock } from "lucide-react";
import { api, PaymentRequest } from "@/lib/api";
import styles from "./page.module.css";

export default function RequestPage() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [payerAccountNumber, setPayerAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.social.paymentRequests.list()
      .then(({ data }) => setRequests(data.requests))
      .catch(() => setError("Failed to load payment requests."))
      .finally(() => setLoading(false));
  }, []);

  async function createRequest() {
    if (!payerAccountNumber.trim() || !amount) return;
    setCreating(true);
    try {
      const res = await api.social.paymentRequests.create({
        payerAccountNumber: payerAccountNumber.trim(),
        amount: parseFloat(amount),
        description: description.trim() || undefined,
      });
      setRequests(r => [res.data.request, ...r]);
      setShowForm(false);
      setPayerAccountNumber(""); setAmount(""); setDescription("");
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  }

  async function payRequest(id: string) {
    try {
      await api.social.paymentRequests.pay(id);
      setRequests(r => r.map(x => x.id === id ? { ...x, status: "paid" as const } : x));
    } catch (e: any) { setError(e.message); }
  }

  async function declineRequest(id: string) {
    try {
      await api.social.paymentRequests.decline(id);
      setRequests(r => r.map(x => x.id === id ? { ...x, status: "declined" as const } : x));
    } catch (e: any) { setError(e.message); }
  }

  if (loading) return <div className={styles.loadingShim} />;

  const incoming = requests.filter(r => r.status === "pending" && r.payerAccountNumber);
  const history = requests.filter(r => r.status !== "pending" || !r.payerAccountNumber);

  return (
    <div className={styles.page}>
      <div className={styles.headerTop}>
        <div>
          <h1 className={styles.title}>Request Money</h1>
          <p className={styles.subtitle}>Ask someone to pay you by their account number.</p>
        </div>
        <button className={styles.newBtn} onClick={() => setShowForm(v => !v)}>
          <Plus size={15} /> New request
        </button>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          {error}
          <button onClick={() => setError("")}><X size={14} /></button>
        </div>
      )}

      {showForm && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Send a payment request</h2>

          <div className={styles.formRow}>
            <label className={styles.label}>Their account number</label>
            <input
              className={styles.field}
              placeholder="8-digit account number"
              value={payerAccountNumber}
              onChange={e => setPayerAccountNumber(e.target.value)}
              maxLength={8}
            />
          </div>

          <div className={styles.formRow}>
            <label className={styles.label}>Amount (£)</label>
            <input
              className={styles.field}
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>

          <div className={styles.formRow}>
            <label className={styles.label}>Description (optional)</label>
            <input
              className={styles.field}
              placeholder="e.g. Rent for May"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <button
            className={styles.submitBtn}
            onClick={() => void createRequest()}
            disabled={creating || !payerAccountNumber.trim() || !amount}
          >
            <Plus size={15} /> {creating ? "Sending…" : "Send request"}
          </button>
        </section>
      )}

      {incoming.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Requests you owe</h2>
          <div className={styles.requestList}>
            {incoming.map(r => (
              <div key={r.id} className={styles.requestCard}>
                <div className={styles.requestCardHeader}>
                  <div className={styles.requestInfo}>
                    <span className={styles.requestAmount}>£{r.amount.toFixed(2)}</span>
                    {r.description && <span className={styles.requestDescription}>{r.description}</span>}
                    <span className={styles.requestMeta}>
                      Requested {new Date(r.createdAt).toLocaleDateString("en-GB")}
                      {r.expiresAt && ` · expires ${new Date(r.expiresAt).toLocaleDateString("en-GB")}`}
                    </span>
                  </div>
                  <span className={`${styles.statusBadge} ${styles.pending}`}>
                    <Clock size={11} /> Pending
                  </span>
                </div>
                <div className={styles.requestActions}>
                  <button className={styles.payBtn} onClick={() => void payRequest(r.id)}>
                    <CheckCircle size={14} /> Pay now
                  </button>
                  <button className={styles.declineBtn} onClick={() => void declineRequest(r.id)}>
                    <XCircle size={14} /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>All requests</h2>
        {requests.length === 0 ? (
          <p className={styles.empty}>No payment requests yet.</p>
        ) : (
          <div className={styles.requestList}>
            {requests.map(r => (
              <div key={r.id} className={`${styles.requestCard} ${r.status !== "pending" ? styles.settled : ""}`}>
                <div className={styles.requestCardHeader}>
                  <div className={styles.requestInfo}>
                    <span className={styles.requestAmount}>£{r.amount.toFixed(2)}</span>
                    {r.description && <span className={styles.requestDescription}>{r.description}</span>}
                    <span className={styles.requestMeta}>
                      {new Date(r.createdAt).toLocaleDateString("en-GB")}
                      {r.payerAccountNumber && ` · to ${r.payerAccountNumber}`}
                    </span>
                  </div>
                  <span className={`${styles.statusBadge} ${styles[r.status]}`}>
                    {r.status === "paid" && <CheckCircle size={11} />}
                    {r.status === "declined" && <XCircle size={11} />}
                    {r.status === "pending" && <Clock size={11} />}
                    {r.status}
                  </span>
                </div>
                {r.status === "pending" && (
                  <div className={styles.requestActions}>
                    <button className={styles.payBtn} onClick={() => void payRequest(r.id)}>
                      <CheckCircle size={14} /> Pay now
                    </button>
                    <button className={styles.declineBtn} onClick={() => void declineRequest(r.id)}>
                      <XCircle size={14} /> Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
