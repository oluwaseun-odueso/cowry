"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CowryLogo } from "@/components/cowry-logo";
import styles from "./page.module.css";

/* ─── Navbar ─────────────────────────────────── */
function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 50); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${styles.nav} ${scrolled ? styles.navScrolled : ""}`}>
      <div className={styles.navInner}>
        {/* Logo */}
        <Link href="/" className={styles.navLogo}>
          <CowryLogo dark />
        </Link>

        {/* Desktop links */}
        <nav className={styles.navLinks}>
          <a href="#about" className={styles.navLink}>About</a>
          <a href="#features" className={styles.navLink}>Features</a>
        </nav>

        {/* Desktop CTA */}
        <div className={styles.navActions}>
          <Link href="/login" className={styles.navLoginBtn}>Login</Link>
          <Link href="/register" className={styles.navSignupBtn}>Sign Up</Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className={styles.hamburger}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          <span className={`${styles.hbar} ${menuOpen ? styles.hbarOpen1 : ""}`} />
          <span className={`${styles.hbar} ${menuOpen ? styles.hbarOpen2 : ""}`} />
          <span className={`${styles.hbar} ${menuOpen ? styles.hbarOpen3 : ""}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
          <a href="#about" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>About</a>
          <a href="#features" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Features</a>
          <Link href="/login" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Login</Link>
          <Link href="/register" className={styles.mobileSignup} onClick={() => setMenuOpen(false)}>Sign Up</Link>
        </div>
      )}
    </header>
  );
}

/* ─── Animated section reveal ─────────────────── */
function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${styles.fadeIn} ${visible ? styles.fadeInVisible : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Hero ────────────────────────────────────── */
function HeroSection() {
  return (
    <section className={styles.hero}>
      {/* Floating card — left */}
      <div className={`${styles.floatCard} ${styles.floatLeft}`}>
        <Image
          src="/images/illustrations/leftCardDashboard.svg"
          alt="Dashboard preview"
          width={220}
          height={160}
          priority
        />
      </div>

      {/* Centre content */}
      <div className={styles.heroCenter}>
        <p className={styles.heroBadge}>Trusted digital banking</p>
        <h1 className={styles.heroTitle}>
          Send, Save &amp;<br />Receive with<br />
          <span className={styles.heroAccent}>Cowry</span>
        </h1>
        <p className={styles.heroSub}>
          Modern banking built for everyone. Secure transfers,
          real-time balances, and complete peace of mind — all in your pocket.
        </p>
        <div className={styles.heroCtas}>
          <Link href="/register" className={styles.heroSignupBtn}>Get started free</Link>
          <Link href="/login" className={styles.heroLoginBtn}>Sign in</Link>
        </div>
      </div>

      {/* 3D Avatar */}
      <div className={styles.heroAvatar}>
        <Image
          src="/images/avatars/hereLocsAvatar.svg"
          alt="Cowry banking character"
          width={420}
          height={480}
          priority
        />
      </div>

      {/* Floating card — right */}
      <div className={`${styles.floatCard} ${styles.floatRight}`}>
        <Image
          src="/images/illustrations/rightCardTransaction.svg"
          alt="Transaction preview"
          width={200}
          height={150}
          priority
        />
      </div>
    </section>
  );
}

/* ─── About ───────────────────────────────────── */
function AboutSection() {
  return (
    <section id="about" className={styles.about}>
      <div className={styles.aboutHeader}>
        <div className={styles.aboutHeaderLeft}>
          <p className={styles.aboutEyebrow}>About Us</p>
          <h2 className={styles.aboutTitle}>
            Send, save, spend fast with Cowry —<br />
            <strong>secure, simple, powerful today.</strong>
          </h2>
        </div>
        <Link href="/register" className={styles.aboutSignupBtn}>Sign Up</Link>
      </div>

      {/* Feature cards grid */}
      <div className={styles.featureGrid}>
        {/* Card 1 — dark purple */}
        <FadeIn delay={0} className={styles.featureCardDark}>
          <div className={styles.featureImg}>
            <Image src="/images/avatars/blackBoyOnLowcut.svg" alt="Smart transfers" width={140} height={140} />
          </div>
          <h3 className={styles.featureTitleLight}>Smart Transfers</h3>
          <p className={styles.featureSubLight}>
            Send money instantly to any Cowry account. Real-time processing with automatic fraud detection.
          </p>
        </FadeIn>

        {/* Card 2 — light blue */}
        <FadeIn delay={100} className={styles.featureCardBlue}>
          <div className={styles.featureImg}>
            <Image src="/images/illustrations/personHoldingMoney.svg" alt="Instant payments" width={140} height={140} />
          </div>
          <h3 className={styles.featureTitleDark}>Instant Payments</h3>
          <p className={styles.featureSubDark}>
            Deposit, withdraw, and transfer funds with zero delays. Your money moves when you need it.
          </p>
        </FadeIn>

        {/* Card 3 — peach */}
        <FadeIn delay={200} className={styles.featureCardPeach}>
          <div className={styles.featureImg}>
            <Image src="/images/illustrations/securityWithNoScam.svg" alt="Bank-grade security" width={140} height={140} />
          </div>
          <h3 className={styles.featureTitleLight}>Bank-Grade Security</h3>
          <p className={styles.featureSubLight}>
            Multi-factor authentication, session management, and real-time fraud alerts keep your money safe.
          </p>
        </FadeIn>
      </div>

      {/* Bottom wide promo card */}
      <FadeIn className={styles.promoCard}>
        <Image
          src="/images/illustrations/vault.svg"
          alt="Savings vault"
          width={120}
          height={120}
          className={styles.promoImg}
        />
        <div className={styles.promoText}>
          <h3 className={styles.promoTitle}>Your savings, always growing</h3>
          <p className={styles.promoSub}>
            Open a savings or current account in minutes. Track every transaction with a full statement history.
          </p>
        </div>
        <Link href="/register" className={styles.promoBtn}>Open an account</Link>
      </FadeIn>
    </section>
  );
}

/* ─── Features ────────────────────────────────── */
function FeaturesSection() {
  const features = [
    {
      icon: "/images/illustrations/compass.svg",
      title: "Total financial visibility",
      body: "See all your accounts, balances, and transactions in one clean dashboard — no more switching between apps.",
    },
    {
      icon: "/images/illustrations/securityWithNoScam.svg",
      title: "Zero-compromise security",
      body: "TOTP-based two-factor authentication, backup codes, encrypted sessions, and proactive scam detection.",
    },
    {
      icon: "/images/illustrations/personHoldingMoney.svg",
      title: "Effortless money movement",
      body: "Transfer by account number, set up recurring payments, and get instant confirmation with every transaction.",
    },
    {
      icon: "/images/illustrations/aboutCard.svg",
      title: "Built for real people",
      body: "Onboard in under two minutes. No paperwork, no branches, no hidden fees — just a bank that works for you.",
    },
  ];

  return (
    <section id="features" className={styles.features}>
      <FadeIn>
        <p className={styles.featuresEyebrow}>Why Cowry</p>
        <h2 className={styles.featuresTitle}>Everything you need from a bank,<br />nothing you don&apos;t.</h2>
      </FadeIn>

      <div className={styles.featuresGrid}>
        {features.map((f, i) => (
          <FadeIn key={f.title} delay={i * 80} className={styles.featurePill}>
            <Image src={f.icon} alt={f.title} width={48} height={48} className={styles.featurePillIcon} />
            <div>
              <h4 className={styles.featurePillTitle}>{f.title}</h4>
              <p className={styles.featurePillBody}>{f.body}</p>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}

/* ─── CTA strip ───────────────────────────────── */
function CtaSection() {
  return (
    <section className={styles.ctaStrip}>
      <div className={styles.ctaInner}>
        <h2 className={styles.ctaTitle}>Ready to take control of your money?</h2>
        <p className={styles.ctaSub}>Join thousands of people who trust Cowry with their finances every day.</p>
        <div className={styles.ctaBtns}>
          <Link href="/register" className={styles.ctaSignupBtn}>Create free account</Link>
          <Link href="/login" className={styles.ctaLoginBtn}>Sign in</Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ──────────────────────────────────── */
function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <CowryLogo />
        <p className={styles.footerCopy}>© {new Date().getFullYear()} Cowry. All rights reserved.</p>
        <nav className={styles.footerLinks}>
          <a href="#about" className={styles.footerLink}>About</a>
          <a href="#features" className={styles.footerLink}>Features</a>
          <Link href="/login" className={styles.footerLink}>Login</Link>
        </nav>
      </div>
    </footer>
  );
}

/* ─── Page root ───────────────────────────────── */
export default function HomePage() {
  return (
    <div className={styles.page}>
      <LandingNav />
      <HeroSection />
      <AboutSection />
      <FeaturesSection />
      <CtaSection />
      <LandingFooter />
    </div>
  );
}
