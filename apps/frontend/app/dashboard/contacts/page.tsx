"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Trash2, User, X } from "lucide-react";
import { api, Contact, PublicUser } from "@/lib/api";
import styles from "./page.module.css";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagSearch, setTagSearch] = useState("");
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [accountNumber, setAccountNumber] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.social.contacts.list()
      .then(({ data }) => setContacts(data.contacts))
      .catch(() => setError("Failed to load contacts."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tagSearch.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      api.social.searchUsers(tagSearch)
        .then(({ data }) => setSearchResults(data.users))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [tagSearch]);

  async function addByTag(user: PublicUser) {
    setAdding(true);
    try {
      const res = await api.social.contacts.create({ tag: user.tag, nickname: user.firstName });
      setContacts(c => [res.data.contact, ...c]);
      setTagSearch(""); setSearchResults([]);
    } catch (e: any) { setError(e.message); }
    finally { setAdding(false); }
  }

  async function addByAccount() {
    if (!accountNumber.trim()) { setError("Account number is required."); return; }
    setAdding(true);
    try {
      const res = await api.social.contacts.create({ accountNumber: accountNumber.trim(), sortCode: sortCode.trim() || undefined, nickname: nickname.trim() || undefined });
      setContacts(c => [res.data.contact, ...c]);
      setAccountNumber(""); setSortCode(""); setNickname("");
    } catch (e: any) { setError(e.message); }
    finally { setAdding(false); }
  }

  async function remove(id: string) {
    await api.social.contacts.delete(id);
    setContacts(c => c.filter(x => x.id !== id));
  }

  if (loading) return <div className={styles.loadingShim} />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Contacts</h1>
        <p className={styles.subtitle}>Save people you send money to regularly.</p>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          {error}
          <button onClick={() => setError("")}><X size={14} /></button>
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Find by @tag</h2>
        <div className={styles.searchRow}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="@username"
            value={tagSearch}
            onChange={e => setTagSearch(e.target.value)}
          />
        </div>
        {searchResults.length > 0 && (
          <div className={styles.results}>
            {searchResults.map(u => (
              <div key={u.id} className={styles.resultRow}>
                <div className={styles.resultAvatar}>{u.firstName[0]}{u.lastName[0]}</div>
                <div className={styles.resultInfo}>
                  <span className={styles.resultName}>{u.firstName} {u.lastName}</span>
                  <span className={styles.resultTag}>@{u.tag}</span>
                </div>
                <button className={styles.addBtn} onClick={() => void addByTag(u)} disabled={adding}>
                  <Plus size={14} /> Add
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Add by account number</h2>
        <div className={styles.formGrid}>
          <input className={styles.field} placeholder="Account number (8 digits)" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} maxLength={8} />
          <input className={styles.field} placeholder="Sort code (optional)" value={sortCode} onChange={e => setSortCode(e.target.value)} maxLength={6} />
          <input className={styles.field} placeholder="Nickname (optional)" value={nickname} onChange={e => setNickname(e.target.value)} />
        </div>
        <button className={styles.submitBtn} onClick={() => void addByAccount()} disabled={adding || !accountNumber.trim()}>
          <Plus size={15} /> {adding ? "Adding…" : "Add contact"}
        </button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Saved contacts</h2>
        {contacts.length === 0 ? (
          <p className={styles.empty}>No contacts yet.</p>
        ) : (
          <div className={styles.list}>
            {contacts.map(c => (
              <div key={c.id} className={styles.contactRow}>
                <div className={styles.contactAvatar}><User size={16} /></div>
                <div className={styles.contactInfo}>
                  <span className={styles.contactName}>{c.nickname ?? (c.tag ? `@${c.tag}` : c.accountNumber)}</span>
                  {c.accountNumber && <span className={styles.contactSub}>{c.accountNumber}{c.sortCode ? ` · ${c.sortCode.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3')}` : ""}</span>}
                  {c.tag && !c.nickname && <span className={styles.contactSub}>@{c.tag}</span>}
                </div>
                <button className={styles.removeBtn} onClick={() => void remove(c.id)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
