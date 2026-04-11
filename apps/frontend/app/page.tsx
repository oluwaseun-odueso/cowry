import Link from "next/link";
import { CowryLogo } from "@/components/cowry-logo";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <CowryLogo tagline="Modern Banking" />
        <span className={styles.accent} />
      </div>

      <div className={styles.hero}>
        <h1 className={styles.headline}>
          Banking for the<br />modern era.
        </h1>
        <p className={styles.subline}>
          Send money, manage accounts, and track your finances —
          all in one place.
        </p>
      </div>

      <div className={styles.actions}>
        <Link href="/register" className={styles.primaryBtn}>Get started</Link>
        <Link href="/login" className={styles.ghostBtn}>Sign in</Link>
      </div>
    </div>
  );
}
