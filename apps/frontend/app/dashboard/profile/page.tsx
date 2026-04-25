"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle, XCircle, Shield, Pencil, X, Check, Copy } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import styles from "./page.module.css";

const AVATARS = [
  { slug: "hereLocsAvatar",   label: "Locs" },
  { slug: "blackBoyOnLowcut", label: "Low cut" },
  { slug: "indianBoy",        label: "Arjun" },
  { slug: "retiredOldMan",    label: "Distinguished" },
  { slug: "retiredOldWoman",  label: "Patricia" },
  { slug: "whiteBoy",         label: "Alex" },
  { slug: "whiteGirl",        label: "Sophie" },
  { slug: "youngGirl1",       label: "Young" },
];

function userInitials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function fmtDateTime(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

type Mode = "view" | "editing" | "saving";

function CopyTag({ tag }: { tag: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(`@${tag}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <span className={styles.tagRow}>
      <span className={styles.tagValue}>@{tag}</span>
      <button className={styles.copyBtn} onClick={copy} type="button" title="Copy tag">
        <Copy size={13} />
        {copied ? "Copied!" : "Copy"}
      </button>
    </span>
  );
}

export default function ProfilePage() {
  const { user, setUser, isLoading } = useAuth();

  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState({ firstName: "", lastName: "", phoneNumber: "" });
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.shimHeader} />
        <div className={styles.shimCard} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <p className={styles.errorMsg}>Profile not found.</p>
      </div>
    );
  }

  function enterEdit() {
    setDraft({
      firstName: user!.firstName,
      lastName: user!.lastName,
      phoneNumber: user!.phoneNumber ?? "",
    });
    setDraftAvatar(user!.avatar ?? null);
    setSaveError("");
    setMode("editing");
  }

  function cancelEdit() {
    setMode("view");
    setSaveError("");
  }

  async function handleSave() {
    if (!user) return;
    setMode("saving");
    setSaveError("");
    try {
      const profilePatch: { firstName?: string; lastName?: string; phoneNumber?: string } = {};
      if (draft.firstName !== user.firstName) profilePatch.firstName = draft.firstName;
      if (draft.lastName !== user.lastName)   profilePatch.lastName  = draft.lastName;
      if (draft.phoneNumber !== (user.phoneNumber ?? "") && draft.phoneNumber !== "")
        profilePatch.phoneNumber = draft.phoneNumber;

      const avatarChanged = draftAvatar !== (user.avatar ?? null);

      let updatedUser = { ...user };

      if (Object.keys(profilePatch).length > 0) {
        const { data } = await api.auth.updateProfile(profilePatch);
        if (data.user) updatedUser = { ...updatedUser, ...data.user };
      }

      if (avatarChanged && draftAvatar) {
        await api.auth.setAvatar(draftAvatar);
        updatedUser = { ...updatedUser, avatar: draftAvatar };
      }

      setUser(updatedUser);
      setMode("view");
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save changes.");
      setMode("editing");
    }
  }

  const isEditing = mode === "editing" || mode === "saving";
  const isSaving  = mode === "saving";

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Profile</h1>
          <p className={styles.subtitle}>Your personal account information.</p>
        </div>
        {mode === "view" && (
          <button className={styles.editBtn} onClick={enterEdit}>
            <Pencil size={14} /> Edit
          </button>
        )}
      </div>

      {/* Hero card */}
      <div className={styles.heroCard}>
        {isEditing ? (
          <div className={styles.editHero}>
            <p className={styles.editAvatarLabel}>Choose your avatar</p>
            <div className={styles.avatarGrid}>
              {AVATARS.map(({ slug, label }) => (
                <button
                  key={slug}
                  type="button"
                  className={`${styles.avatarGridBtn} ${draftAvatar === slug ? styles.avatarGridBtnSelected : ""}`}
                  onClick={() => setDraftAvatar(slug)}
                  aria-label={label}
                  disabled={isSaving}
                >
                  <Image
                    src={`/images/avatars/${slug}.svg`}
                    alt={label}
                    width={52}
                    height={52}
                    className={styles.avatarGridImg}
                  />
                  <span className={styles.avatarGridLabel}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {user.avatar ? (
              <Image
                src={`/images/avatars/${user.avatar}.svg`}
                alt="Your avatar"
                width={80}
                height={80}
                className={styles.avatarImg}
              />
            ) : (
              <div className={styles.avatar}>{userInitials(user.firstName, user.lastName)}</div>
            )}
            <div className={styles.heroInfo}>
              <h2 className={styles.heroName}>{user.firstName} {user.lastName}</h2>
              <p className={styles.heroEmail}>{user.email}</p>
              <div className={styles.heroBadges}>
                <span className={`${styles.badge} ${user.role === "admin" ? styles.badgeAdmin : styles.badgeUser}`}>
                  {user.role}
                </span>
                <span className={`${styles.badge} ${user.status === "active" ? styles.badgeActive : styles.badgeSuspended}`}>
                  {user.status}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Details card */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Account details</h3>
        <div className={styles.rows}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>First name</span>
            {isEditing ? (
              <input
                className={styles.fieldInput}
                value={draft.firstName}
                onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
                disabled={isSaving}
                maxLength={50}
              />
            ) : (
              <span className={styles.rowValue}>{user.firstName}</span>
            )}
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Last name</span>
            {isEditing ? (
              <input
                className={styles.fieldInput}
                value={draft.lastName}
                onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
                disabled={isSaving}
                maxLength={50}
              />
            ) : (
              <span className={styles.rowValue}>{user.lastName}</span>
            )}
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Tag</span>
            <span className={styles.rowValue}>
              {user.tag ? <CopyTag tag={user.tag} /> : <span style={{ color: "#9CA3AF" }}>—</span>}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Email</span>
            <span className={styles.rowValue}>{user.email}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Phone number</span>
            {isEditing ? (
              <input
                className={styles.fieldInput}
                value={draft.phoneNumber}
                onChange={(e) => setDraft((d) => ({ ...d, phoneNumber: e.target.value }))}
                disabled={isSaving}
                maxLength={20}
                placeholder="+44 7700 900000"
              />
            ) : (
              <span className={styles.rowValue}>{user.phoneNumber ?? "—"}</span>
            )}
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Member since</span>
            <span className={styles.rowValue}>{fmtDate(user.createdAt)}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Last login</span>
            <span className={styles.rowValue}>{fmtDateTime(user.lastLogin)}</span>
          </div>
        </div>

        {isEditing && (
          <div className={styles.editActions}>
            {saveError && <p className={styles.saveError}>{saveError}</p>}
            <button className={styles.cancelBtn} onClick={cancelEdit} disabled={isSaving}>
              <X size={14} /> Cancel
            </button>
            <button className={styles.saveBtn} onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "Saving…" : <><Check size={14} /> Save changes</>}
            </button>
          </div>
        )}
      </div>

      {/* Security status card */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Security status</h3>
        <div className={styles.rows}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Email verified</span>
            <span className={styles.rowValue}>
              {user.emailVerified
                ? <span className={styles.statusOk}><CheckCircle size={15} /> Verified</span>
                : <span className={styles.statusBad}><XCircle size={15} /> Not verified</span>}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Two-factor auth</span>
            <span className={styles.rowValue}>
              {user.isMfaEnabled
                ? <span className={styles.statusOk}><Shield size={15} /> Enabled</span>
                : <span className={styles.statusWarn}><Shield size={15} /> Disabled</span>}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
