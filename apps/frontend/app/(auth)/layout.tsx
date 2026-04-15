import Image from "next/image";
import { CowryLogo } from "@/components/cowry-logo";
import styles from "./layout.module.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.root}>
      {/* Brand panel — hidden on mobile, visible at ≥768px */}
      <aside className={styles.brandPanel}>
        <div className={styles.brandTop}>
          <CowryLogo dark tagline="Trusted digital banking" />
        </div>

        <div className={styles.brandIllustration}>
          <Image
            src="/images/illustrations/securityWithNoScam.svg"
            alt="Security illustration"
            width={200}
            height={200}
            priority
            className={styles.brandIllustrationImg}
          />
        </div>

        <ul className={styles.trustList}>
          <li className={styles.trustItem}>Bank-grade 256-bit AES encryption</li>
          <li className={styles.trustItem}>TOTP multi-factor authentication</li>
          <li className={styles.trustItem}>Real-time fraud monitoring</li>
          <li className={styles.trustItem}>Zero hidden fees, ever</li>
        </ul>

        <div className={styles.brandGlow} aria-hidden />
      </aside>

      {/* Form panel */}
      <main className={styles.formPanel}>
        {children}
      </main>
    </div>
  );
}
