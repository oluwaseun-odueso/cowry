"use client";

import { useEffect, useRef, useState } from "react";
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
  User,
  X,
} from "lucide-react";
import { CowryLogo } from "@/components/cowry-logo";
import { useAuth } from "@/lib/auth-context";
import styles from "./layout.module.css";

const NAV = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Accounts", href: "/dashboard/accounts", icon: CreditCard },
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "Security", href: "/dashboard/security", icon: Shield },
];

const BREADCRUMB: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/accounts": "Accounts",
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
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

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
    await logout();
    router.push("/login");
  }

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : "?";

  const isAdmin = user?.role === "admin";
  const mfaEnabled = user?.isMfaEnabled ?? false;
  const breadcrumb = deriveBreadcrumb(pathname);

  return (
    <div className={styles.shell}>
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
          <CowryLogo dark size={28} />
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
