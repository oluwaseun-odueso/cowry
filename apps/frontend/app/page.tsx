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
        <Link href="/" className={styles.navLogo}>
          <CowryLogo dark />
        </Link>

        <nav className={styles.navLinks}>
          <a href="#about" className={styles.navLink}>About</a>
          <a href="#features" className={styles.navLink}>Features</a>
        </nav>

        <div className={styles.navActions}>
          <Link href="/login" className={styles.navLoginBtn}>Login</Link>
          <Link href="/register" className={styles.navSignupBtn}>Sign Up</Link>
        </div>

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
      { threshold: 0.1 }
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
      {/* Ambient glow */}
      <div className={styles.heroGlow} aria-hidden />

      {/* Floating card — left */}
      <div className={`${styles.floatCard} ${styles.floatLeft}`}>
        <Image
          src="/images/illustrations/leftCardDashboard.svg"
          alt="Dashboard preview"
          width={240}
          height={175}
          priority
        />
      </div>

      {/* Centre content */}
      <div className={styles.heroCenter}>
        <p className={styles.heroBadge}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Bank-grade security · 256-bit encryption
        </p>
        <h1 className={styles.heroTitle}>
          Send, Save &amp;<br />Receive with<br />
          <span className={styles.heroAccent}>Cowry</span>
        </h1>
        <p className={styles.heroSub}>
          Your money, protected and growing. Open an account in 2 minutes —
          no branches, no paperwork, zero fees.
        </p>
        <div className={styles.heroCtas}>
          <Link href="/register" className={styles.heroSignupBtn}>Get started free</Link>
          <Link href="/login" className={styles.heroLoginBtn}>Sign in</Link>
        </div>
      </div>

      {/* 3D Avatar */}
      <div className={styles.heroAvatarWrap}>
        <Image
          src="/images/avatars/hereLocsAvatar.svg"
          alt="Cowry banking character"
          width={420}
          height={500}
          priority
          className={styles.heroAvatarImg}
        />
      </div>

      {/* Floating card — right */}
      <div className={`${styles.floatCard} ${styles.floatRight}`}>
        <Image
          src="/images/illustrations/rightCardTransaction.svg"
          alt="Transaction preview"
          width={215}
          height={160}
          priority
        />
      </div>

      {/* Connector arrows — desktop only */}
      <svg className={styles.heroConnectors} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid meet" aria-hidden fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrowHead" markerWidth="7" markerHeight="7" refX="1" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7" stroke="rgba(183,213,255,0.55)" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </marker>
        </defs>
        {/* Left: avatar left edge → left card bottom-center, one swirl */}
        <path
          d="M 500,640 C 450,675 310,665 305,600 C 300,545 264,590 264,553"
          stroke="rgba(183,213,255,0.45)"
          strokeWidth="1.5"
          strokeDasharray="10 10"
          strokeLinecap="round"
          markerEnd="url(#arrowHead)"
        />
        {/* Right: avatar right edge → right card bottom-center, one swirl */}
        <path
          d="M 940,640 C 990,675 1130,665 1135,600 C 1140,545 1188,590 1188,538"
          stroke="rgba(183,213,255,0.45)"
          strokeWidth="1.5"
          strokeDasharray="10 10"
          strokeLinecap="round"
          markerEnd="url(#arrowHead)"
        />
      </svg>

      {/* Trust strip */}
      <div className={styles.trustStrip}>
        {["256-bit AES encryption", "TOTP two-factor auth", "Real-time fraud detection", "Zero hidden fees"].map((t) => (
          <span key={t} className={styles.trustItem}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {t}
          </span>
        ))}
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
          <p className={styles.aboutEyebrow}>Who We Are</p>
          {/* <h2 className={styles.aboutTitle}>
            Banking that respects<br />your time — and your money.
          </h2> */}
          <h2 className={styles.aboutTitle}>
            Banking that respects<br />your time and your money.
          </h2>
          {/* <p className={styles.aboutSubtitle}>
            Cowry gives you the tools, transparency, and security of a high-street bank —
            without any of the friction.
          </p> */}
          <p className={styles.aboutSubtitle}>
            Cowry gives you the tools, transparency, and security of a high-street bank, without any of the friction.
          </p>
        </div>
        <Link href="/register" className={styles.aboutSignupBtn}>Sign Up</Link>
      </div>

      <div className={styles.featureGrid}>
        {/* Card 1 — dark purple */}
        <FadeIn delay={0} className={styles.featureCardDark}>
          <span className={styles.featureNum}>01</span>
          <div className={styles.featureImg}>
            <Image src="/images/avatars/blackBoyOnLowcut.svg" alt="Smart transfers" width={140} height={140} />
          </div>
          <h3 className={styles.featureTitleLight}>Smart Transfers</h3>
          <p className={styles.featureSubLight}>
            Send money instantly to any Cowry account. Real-time processing with
            automatic fraud detection on every transaction.
          </p>
        </FadeIn>

        {/* Card 2 — light blue */}
        <FadeIn delay={100} className={styles.featureCardBlue}>
          <span className={styles.featureNumDark}>02</span>
          <div className={styles.featureImg}>
            <Image src="/images/illustrations/personHoldingMoney.svg" alt="Instant payments" width={140} height={140} />
          </div>
          <h3 className={styles.featureTitleDark}>Instant Payments</h3>
          <p className={styles.featureSubDark}>
            Deposit, withdraw, and transfer funds with zero delays. Your money
            moves exactly when you need it.
          </p>
        </FadeIn>

        {/* Card 3 — peach */}
        <FadeIn delay={200} className={styles.featureCardPeach}>
          <span className={styles.featureNumLight}>03</span>
          <div className={styles.featureImg}>
            <Image src="/images/illustrations/securityWithNoScam.svg" alt="Bank-grade security" width={140} height={140} />
          </div>
          <h3 className={styles.featureTitleLight}>Zero-Compromise Security</h3>
          <p className={styles.featureSubLight}>
            TOTP multi-factor authentication, encrypted sessions, and proactive
            fraud detection shield every transaction you make.
          </p>
        </FadeIn>
      </div>

      {/* Promo card */}
      <FadeIn className={styles.promoCard}>
        <Image
          src="/images/illustrations/vault.svg"
          alt="Savings vault"
          width={110}
          height={110}
          className={styles.promoImg}
        />
        <div className={styles.promoText}>
          <h3 className={styles.promoTitle}>Your savings, always growing</h3>
          <p className={styles.promoSub}>
            Open a savings or current account in minutes. Track every transaction
            with a full statement history and real-time balance updates.
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
      tint: "rgba(35, 22, 77, 0.07)",
    },
    {
      icon: "/images/illustrations/securityWithNoScam.svg",
      title: "Zero-compromise security",
      body: "TOTP-based two-factor authentication, backup codes, encrypted sessions, and proactive scam detection.",
      tint: "rgba(253, 107, 82, 0.08)",
    },
    {
      icon: "/images/illustrations/personHoldingMoney.svg",
      title: "Effortless money movement",
      body: "Transfer by account number, set up recurring payments, and get instant confirmation with every transaction.",
      tint: "rgba(183, 213, 255, 0.22)",
    },
    {
      icon: "/images/illustrations/aboutCard.svg",
      title: "Built for real people",
      body: "Onboard in under two minutes. No paperwork, no branches, no hidden fees — just a bank that works for you.",
      tint: "rgba(5, 150, 105, 0.08)",
    },
  ];

  return (
    <section id="features" className={styles.features}>
      <FadeIn>
        <p className={styles.featuresEyebrow}>Why Cowry</p>
        <h2 className={styles.featuresTitle}>
          Everything you need from a bank,<br />nothing you don&apos;t.
        </h2>
      </FadeIn>

      <div className={styles.featuresGrid}>
        {features.map((f, i) => (
          <FadeIn key={f.title} delay={i * 80} className={styles.featurePill}>
            <div className={styles.featurePillIconWrap} style={{ background: f.tint }}>
              <Image src={f.icon} alt={f.title} width={28} height={28} className={styles.featurePillIcon} />
            </div>
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

/* ─── Testimonials ────────────────────────────── */
function TestimonialsSection() {
  const testimonials = [
    {
      avatar: "/images/avatars/indianBoy.svg",
      name: "Arjun M.",
      role: "Savings account holder",
      quote: "Cowry made me feel like my money was genuinely protected. The MFA setup took 30 seconds and I've had zero anxiety about security since.",
    },
    {
      avatar: "/images/avatars/retiredOldWoman.svg",
      name: "Patricia O.",
      role: "Current account holder",
      quote: "Finally a bank that speaks plainly. I see every transaction the moment it happens, and the support team actually replies within minutes.",
    },
    {
      avatar: "/images/avatars/youngGirl1.svg",
      name: "Sophie T.",
      role: "Savings account holder",
      quote: "I moved all my savings here because I trust the security. The interface is so clean I actually check my balance every single day.",
    },
  ];

  return (
    <section className={styles.testimonials}>
      <FadeIn>
        <p className={styles.testimonialsEyebrow}>Trusted by real people</p>
        <h2 className={styles.testimonialsTitle}>Trusted by people like you.</h2>
      </FadeIn>
      <div className={styles.testimonialsGrid}>
        {testimonials.map((t, i) => (
          <FadeIn key={t.name} delay={i * 100} className={styles.testimonialCard}>
            <div className={styles.testimonialStars}>★★★★★</div>
            <blockquote className={styles.testimonialQuote}>&ldquo;{t.quote}&rdquo;</blockquote>
            <div className={styles.testimonialAuthor}>
              <Image src={t.avatar} alt={t.name} width={44} height={44} className={styles.testimonialAvatar} />
              <div>
                <p className={styles.testimonialName}>{t.name}</p>
                <p className={styles.testimonialRole}>{t.role}</p>
              </div>
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
      <div className={styles.ctaGlow} aria-hidden />
      <div className={styles.ctaInner}>
        <h2 className={styles.ctaTitle}>Your financial future starts here.</h2>
        <p className={styles.ctaSub}>
          Join thousands who already trust Cowry with their savings, transfers,
          and day-to-day banking.
        </p>
        <div className={styles.ctaBtns}>
          <Link href="/register" className={styles.ctaSignupBtn}>Create a free account</Link>
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
      <div className={styles.footerGrid}>
        <div className={styles.footerBrand}>
          <CowryLogo dark />
          <p className={styles.footerTagline}>Trusted digital banking</p>
        </div>
        <div className={styles.footerCol}>
          <p className={styles.footerColTitle}>Product</p>
          <nav className={styles.footerColLinks}>
            <Link href="/dashboard" className={styles.footerLink}>Dashboard</Link>
            <Link href="/dashboard/accounts" className={styles.footerLink}>Accounts</Link>
            <Link href="/dashboard/security" className={styles.footerLink}>Security</Link>
          </nav>
        </div>
        <div className={styles.footerCol}>
          <p className={styles.footerColTitle}>Company</p>
          <nav className={styles.footerColLinks}>
            <a href="#about" className={styles.footerLink}>About</a>
            <a href="#features" className={styles.footerLink}>Features</a>
            <a href="#" className={styles.footerLink}>Privacy</a>
          </nav>
        </div>
        <div className={styles.footerCol}>
          <p className={styles.footerColTitle}>Security</p>
          <div className={styles.footerTrust}>
            <span className={styles.footerTrustItem}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              256-bit encryption
            </span>
            <span className={styles.footerTrustItem}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
              FSCS Protected
            </span>
            <span className={styles.footerTrustItem}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              Real-time alerts
            </span>
          </div>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <p className={styles.footerCopy}>© {new Date().getFullYear()} Cowry. All rights reserved.</p>
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
      <TestimonialsSection />
      <CtaSection />
      <LandingFooter />
    </div>
  );
}
