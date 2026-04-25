"use client";

import { useEffect, useState, use } from "react";
import { Plus, Trash2, X, Users, CheckCircle, XCircle } from "lucide-react";
import { api, SplitRequest, Contact } from "@/lib/api";
import styles from "./page.module.css";

interface Participant {
  tag?: string;
  accountNumber?: string;
  amount: string;
  label: string;
}

export default function SplitPage({ searchParams }: { searchParams: Promise<{ amount?: string; description?: string }> }) {
  const params = use(searchParams);
  const [splits, setSplits] = useState<SplitRequest[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New split form
  const [showForm, setShowForm] = useState(!!params.amount);
  const [totalAmount, setTotalAmount] = useState(params.amount ?? "");
  const [description, setDescription] = useState(params.description ?? "");
  const [participants, setParticipants] = useState<Participant[]>([
    { tag: "", accountNumber: "", amount: "", label: "" },
  ]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([
      api.social.splits.list(),
      api.social.contacts.list(),
    ])
      .then(([s, c]) => {
        setSplits(s.data.splits);
        setContacts(c.data.contacts);
      })
      .catch(() => setError("Failed to load splits."))
      .finally(() => setLoading(false));
  }, []);

  function addParticipant() {
    setParticipants(p => [...p, { tag: "", accountNumber: "", amount: "", label: "" }]);
  }

  function removeParticipant(i: number) {
    setParticipants(p => p.filter((_, idx) => idx !== i));
  }

  function updateParticipant(i: number, key: keyof Participant, value: string) {
    setParticipants(p => p.map((x, idx) => idx === i ? { ...x, [key]: value } : x));
  }

  function selectContact(i: number, c: Contact) {
    setParticipants(p => p.map((x, idx) => idx !== i ? x : {
      ...x,
      tag: c.tag ?? "",
      accountNumber: c.tag ? "" : (c.accountNumber ?? ""),
      label: c.nickname ?? (c.tag ? `@${c.tag}` : c.accountNumber ?? ""),
    }));
  }

  async function createSplit() {
    if (!totalAmount || participants.length === 0) return;
    const valid = participants.map(p => ({
      tag: p.tag || undefined,
      accountNumber: p.accountNumber || undefined,
      amount: parseFloat(p.amount),
    })).filter(p => !isNaN(p.amount) && p.amount > 0 && (p.tag || p.accountNumber));

    if (valid.length === 0) { setError("Add at least one valid participant with an amount."); return; }

    setCreating(true);
    try {
      const res = await api.social.splits.create({
        totalAmount: parseFloat(totalAmount),
        description: description || undefined,
        participants: valid,
      });
      setSplits(s => [res.data.split, ...s]);
      setShowForm(false);
      setTotalAmount(""); setDescription("");
      setParticipants([{ tag: "", accountNumber: "", amount: "", label: "" }]);
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  }

  async function paySplit(id: string) {
    try {
      const res = await api.social.splits.pay(id);
      setSplits(s => s.map(x => x.id !== id ? x : res.data.split));
    } catch (e: any) { setError(e.message); }
  }

  async function declineSplit(id: string) {
    try {
      await api.social.splits.decline(id);
      setSplits(s => s.map(x => {
        if (x.id !== id) return x;
        return { ...x, participants: x.participants?.map(p => ({ ...p, status: "declined" as const })) };
      }));
    } catch (e: any) { setError(e.message); }
  }

  if (loading) return <div className={styles.loadingShim} />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.title}>Split Bills</h1>
            <p className={styles.subtitle}>Share expenses with friends and contacts.</p>
          </div>
          <button className={styles.newBtn} onClick={() => setShowForm(v => !v)}>
            <Plus size={15} /> New split
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          {error}
          <button onClick={() => setError("")}><X size={14} /></button>
        </div>
      )}

      {showForm && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>New bill split</h2>

          <div className={styles.formRow}>
            <label className={styles.label}>Total amount (£)</label>
            <input
              className={styles.field}
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={totalAmount}
              onChange={e => setTotalAmount(e.target.value)}
            />
          </div>

          <div className={styles.formRow}>
            <label className={styles.label}>Description (optional)</label>
            <input
              className={styles.field}
              placeholder="e.g. Dinner at The George"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className={styles.participantsHeader}>
            <span className={styles.label}>Participants</span>
            <button className={styles.addParticipantBtn} onClick={addParticipant}>
              <Plus size={13} /> Add
            </button>
          </div>

          <div className={styles.participantsList}>
            {participants.map((p, i) => (
              <div key={i} className={styles.participantRow}>
                <div className={styles.participantInputs}>
                  <select
                    className={styles.fieldSmall}
                    value={p.tag ? `tag:${p.tag}` : p.accountNumber ? `acc:${p.accountNumber}` : ""}
                    onChange={e => {
                      const val = e.target.value;
                      if (val.startsWith("tag:")) {
                        updateParticipant(i, "tag", val.slice(4));
                        updateParticipant(i, "accountNumber", "");
                      } else if (val.startsWith("acc:")) {
                        updateParticipant(i, "accountNumber", val.slice(4));
                        updateParticipant(i, "tag", "");
                      }
                    }}
                  >
                    <option value="">Select contact…</option>
                    {contacts.map(c => (
                      <option
                        key={c.id}
                        value={c.tag ? `tag:${c.tag}` : `acc:${c.accountNumber}`}
                        onClick={() => selectContact(i, c)}
                      >
                        {c.nickname ?? (c.tag ? `@${c.tag}` : c.accountNumber)}
                      </option>
                    ))}
                  </select>
                  <span className={styles.orText}>or</span>
                  <input
                    className={styles.fieldSmall}
                    placeholder="@tag or account no."
                    value={p.tag ? `@${p.tag}` : p.accountNumber ?? ""}
                    onChange={e => {
                      const v = e.target.value;
                      if (v.startsWith("@")) {
                        updateParticipant(i, "tag", v.slice(1));
                        updateParticipant(i, "accountNumber", "");
                      } else {
                        updateParticipant(i, "accountNumber", v);
                        updateParticipant(i, "tag", "");
                      }
                    }}
                  />
                  <input
                    className={styles.fieldTiny}
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="£ amount"
                    value={p.amount}
                    onChange={e => updateParticipant(i, "amount", e.target.value)}
                  />
                </div>
                {participants.length > 1 && (
                  <button className={styles.removeParticipantBtn} onClick={() => removeParticipant(i)}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            className={styles.submitBtn}
            onClick={() => void createSplit()}
            disabled={creating || !totalAmount}
          >
            <Users size={15} /> {creating ? "Creating…" : "Create split"}
          </button>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Your splits</h2>
        {splits.length === 0 ? (
          <p className={styles.empty}>No split requests yet.</p>
        ) : (
          <div className={styles.splitList}>
            {splits.map(s => (
              <div key={s.id} className={styles.splitCard}>
                <div className={styles.splitCardHeader}>
                  <div className={styles.splitInfo}>
                    <span className={styles.splitDescription}>{s.description || "Bill split"}</span>
                    <span className={styles.splitMeta}>
                      {s.reference} · £{s.totalAmount.toFixed(2)} total · {new Date(s.createdAt).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  <span className={`${styles.statusBadge} ${styles[s.status]}`}>{s.status}</span>
                </div>

                {s.participants && s.participants.length > 0 && (
                  <div className={styles.participantsGrid}>
                    {s.participants.map(p => (
                      <div key={p.id} className={styles.participantChip}>
                        <span className={styles.participantName}>
                          {p.userId ?? p.accountNumber ?? "Unknown"}
                        </span>
                        <span className={styles.participantAmount}>£{p.amount.toFixed(2)}</span>
                        <span className={`${styles.participantStatus} ${styles[p.status]}`}>
                          {p.status === "paid" ? <CheckCircle size={12} /> : p.status === "declined" ? <XCircle size={12} /> : null}
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {s.status === "pending" && (
                  <div className={styles.splitActions}>
                    <button className={styles.payBtn} onClick={() => void paySplit(s.id)}>
                      <CheckCircle size={14} /> Mark as paid
                    </button>
                    <button className={styles.declineBtn} onClick={() => void declineSplit(s.id)}>
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
