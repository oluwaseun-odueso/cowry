import Image from "next/image";
import styles from "./cowry-logo.module.css";

interface CowryLogoProps {
  /** Optional tagline shown below the wordmark */
  tagline?: string;
  /**
   * When true the "Cowry" wordmark is rendered in white (dark backgrounds).
   * Defaults to false → black text (light backgrounds).
   */
  dark?: boolean;
  /** Logo image size in pixels (width = height). Defaults to 36. */
  size?: number;
}

export function CowryLogo({ tagline, dark = false, size = 36 }: CowryLogoProps) {
  return (
    <div className={styles.root}>
      <div className={styles.logoRow}>
        <Image
          src="/images/logo/cowryLogo.svg"
          alt="Cowry"
          width={size}
          height={size}
          priority
        />
        <span className={dark ? styles.wordmarkLight : styles.wordmarkDark}>Cowry</span>
      </div>
      {tagline && <span className={dark ? styles.taglineLight : styles.taglineDark}>{tagline}</span>}
    </div>
  );
}
