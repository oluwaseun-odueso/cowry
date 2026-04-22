"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import styles from "./page.module.css";

const AVATARS = [
  { slug: "hereLocsAvatar", label: "Locs" },
  { slug: "blackBoyOnLowcut", label: "Low cut" },
  { slug: "indianBoy", label: "Arjun" },
  { slug: "retiredOldMan", label: "Distinguished" },
  { slug: "retiredOldWoman", label: "Patricia" },
  { slug: "whiteBoy", label: "Alex" },
  { slug: "whiteGirl", label: "Sophie" },
  { slug: "youngGirl1", label: "Young" },
];

export default function SetupAvatarPage() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!selected) { router.push("/setup-passcode"); return; }
    setSaving(true);
    try {
      await api.auth.setAvatar(selected);
      if (user) setUser({ ...user, avatar: selected });
      router.push("/setup-passcode");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>👤</div>
        </div>
        <h1 className={styles.title}>Choose your avatar</h1>
        <p className={styles.subtitle}>Pick a character that represents you in Cowry.</p>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.grid}>
          {AVATARS.map(({ slug, label }) => (
            <button
              key={slug}
              className={`${styles.avatarBtn} ${selected === slug ? styles.avatarSelected : ""}`}
              onClick={() => setSelected(slug)}
              type="button"
              aria-label={label}
            >
              <div className={styles.avatarImgWrap}>
                <Image
                  src={`/images/avatars/${slug}.svg`}
                  alt={label}
                  width={72}
                  height={72}
                  className={styles.avatarImg}
                />
              </div>
              <span className={styles.avatarLabel}>{label}</span>
            </button>
          ))}
        </div>

        <div className={styles.actions}>
          <button
            className={styles.primaryBtn}
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? "Saving…" : selected ? "Continue" : "Skip for now"}
          </button>
        </div>
      </div>
    </div>
  );
}
