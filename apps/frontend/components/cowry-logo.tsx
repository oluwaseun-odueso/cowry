import styles from "./cowry-logo.module.css";

export function CowryLogo({ tagline, dark }: { tagline?: string; dark?: boolean }) {
  return (
    <div className={styles.root}>
      <div className={styles.mark}>
        <span className={styles.markLetter}>C</span>
      </div>
      <span className={dark ? styles.wordmarkDark : styles.wordmark}>Cowry</span>
      {tagline && <span className={styles.tagline}>{tagline}</span>}
    </div>
  );
}
