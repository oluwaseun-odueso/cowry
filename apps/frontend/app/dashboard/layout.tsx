"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SplitSquareHorizontal,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { CowryLogo } from "@/components/cowry-logo";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { startActivityTracker, stopActivityTracker } from "@/lib/activity-tracker";
import { startInactivityLock, stopInactivityLock } from "@/lib/inactivity-lock";
import styles from "./layout.module.css";

const NAV = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Accounts", href: "/dashboard/accounts", icon: CreditCard },
  { label: "Cards", href: "/dashboard/cards", icon: Wallet },
  { label: "Contacts", href: "/dashboard/contacts", icon: Users },
  { label: "Split", href: "/dashboard/split", icon: SplitSquareHorizontal },
  { label: "Request", href: "/dashboard/request", icon: Bell },
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "Security", href: "/dashboard/security", icon: Shield },
];

const BREADCRUMB: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/accounts": "Accounts",
  "/dashboard/cards": "Cards",
  "/dashboard/contacts": "Contacts",
  "/dashboard/split": "Split Bills",
  "/dashboard/request": "Request Money",
  "/dashboard/profile": "Profile",
  "/dashboard/security": "Security",
  "/dashboard/admin": "Admin",
};

function deriveBreadcrumb(pathname: string): string {
  if (BREADCRUMB[pathname]) return BREADCRUMB[pathname];
  const match = Object.keys(BREADCRUMB)
    .filter((k) => k !== "/dashboard" && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? BREADCRUMB[match] : "Overview";
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isLocked, lock, unlock } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [passcodeDigits, setPasscodeDigits] = useState<string[]>(Array(6).fill(""));
  const [passcodeError, setPasscodeError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const passcodeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Start activity tracker and inactivity lock when mounted
  useEffect(() => {
    startActivityTracker();
    startInactivityLock();
    return () => {
      stopActivityTracker();
      stopInactivityLock();
    };
  }, []);

  // Listen for lockSession event dispatched by inactivity-lock.ts
  useEffect(() => {
    function onLock() { lock(); }
    window.addEventListener("lockSession", onLock);
    return () => window.removeEventListener("lockSession", onLock);
  }, [lock]);

  // Focus first passcode input when lock screen appears
  useEffect(() => {
    if (isLocked) {
      setPasscodeDigits(Array(6).fill(""));
      setPasscodeError("");
      setTimeout(() => passcodeRefs.current[0]?.focus(), 100);
    }
  }, [isLocked]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function handleLogout() {
    stopActivityTracker();
    stopInactivityLock();
    await logout();
    router.push("/login");
  }

  function handlePasscodeDigit(i: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const next = [...passcodeDigits];
    next[i] = val.slice(-1);
    setPasscodeDigits(next);
    if (val && i < 5) passcodeRefs.current[i + 1]?.focus();
    // Auto-submit when all 6 filled
    if (val && i === 5 && next.every(d => d)) {
      void submitPasscode(next.join(""));
    }
  }

  function handlePasscodeKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === "Backspace" && !passcodeDigits[i] && i > 0) {
      passcodeRefs.current[i - 1]?.focus();
    }
  }

  async function submitPasscode(code: string) {
    setUnlocking(true);
    setPasscodeError("");
    try {
      await api.auth.verifyPasscode(code);
      unlock();
    } catch {
      setPasscodeError("Incorrect passcode. Try again.");
      setPasscodeDigits(Array(6).fill(""));
      setTimeout(() => passcodeRefs.current[0]?.focus(), 50);
    } finally {
      setUnlocking(false);
    }
  }

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : "?";

  const isAdmin = user?.role === "admin";
  const mfaEnabled = user?.isMfaEnabled ?? false;
  const breadcrumb = deriveBreadcrumb(pathname);

  return (
    <div className={styles.shell}>
      {isLocked && (
        <div className={styles.lockScreen} role="dialog" aria-modal aria-label="Session locked">
          <div className={styles.lockCard}>
            {user?.avatar ? (
              <Image
                src={`/images/avatars/${user.avatar}.svg`}
                alt="Your avatar"
                width={80}
                height={80}
                className={styles.lockAvatar}
              />
            ) : (
              <div className={styles.lockInitials}>{initials}</div>
            )}
            <p className={styles.lockName}>{user?.firstName} {user?.lastName}</p>
            <p className={styles.lockHint}>Enter your passcode to continue</p>

            <div className={styles.lockPinRow}>
              {passcodeDigits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { passcodeRefs.current[i] = el; }}
                  className={`${styles.lockPinInput} ${d ? styles.lockPinFilled : ""}`}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handlePasscodeDigit(i, e.target.value)}
                  onKeyDown={e => handlePasscodeKeyDown(e, i)}
                  disabled={unlocking}
                />
              ))}
            </div>

            {passcodeError && <p className={styles.lockError}>{passcodeError}</p>}

            <button className={styles.lockLogout} onClick={() => void handleLogout()}>
              Not you? Sign out
            </button>
          </div>
        </div>
      )}
      <header className={styles.topNav}>
        <div className={styles.topNavLeft}>
          <button
            className={styles.hamburger}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className={styles.breadcrumb}>
            <span className={styles.breadcrumbRoot}>Dashboard</span>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>{breadcrumb}</span>
          </div>
        </div>

        <div className={styles.topNavRight}>
          <div
            className={`${styles.securityBadge} ${mfaEnabled ? styles.securityBadgeOk : styles.securityBadgeWarn}`}
            title={mfaEnabled ? "2FA enabled" : "Enable 2FA for stronger protection"}
          >
            {mfaEnabled ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
            <span>{mfaEnabled ? "Protected" : "Secure your account"}</span>
          </div>
          <button className={styles.bellBtn} aria-label="Notifications">
            <Bell size={18} />
          </button>
          <div className={styles.topDivider} aria-hidden />
          <div
            className={styles.avatar}
            title={user ? `${user.firstName} ${user.lastName}` : ""}
          >
            {initials}
          </div>
        </div>
      </header>

      {open && (
        <div
          className={styles.overlay}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        ref={sidebarRef}
        className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}
        aria-label="Main navigation"
      >
        <div className={styles.sidebarLogo}>
          <CowryLogo dark size={20} />
        </div>

        <nav className={styles.nav}>
          {NAV.map(({ label, href, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/dashboard/admin"
              className={`${styles.navLink} ${pathname.startsWith("/dashboard/admin") ? styles.navLinkActive : ""}`}
            >
              <ShieldAlert size={18} />
              <span>Admin</span>
            </Link>
          )}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarUser}>
            <div className={styles.sidebarAvatar}>{initials}</div>
            <div className={styles.sidebarUserInfo}>
              <p className={styles.sidebarUserName}>
                {user?.firstName} {user?.lastName}
              </p>
              <p className={styles.sidebarUserEmail}>{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className={styles.signOutBtn}>
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
