"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import styles from "./layout.module.css";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Accounts", href: "/dashboard/accounts", icon: CreditCard },
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "Security", href: "/dashboard/security", icon: Shield },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  // Close sidebar on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Close sidebar when route changes (mobile navigation)
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

  return (
    <div className={styles.shell}>
      {/* ── Top navigation bar ── */}
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
          <div className={styles.navLogo}>
            <div className={styles.navLogoMark}>C</div>
            <span className={styles.navLogoWord}>Cowry</span>
          </div>
        </div>

        <div className={styles.topNavRight}>
          <div
            className={styles.avatar}
            title={user ? `${user.firstName} ${user.lastName}` : ""}
          >
            {initials}
          </div>
        </div>
      </header>

      {/* ── Sidebar overlay (mobile) ── */}
      {open && (
        <div
          className={styles.overlay}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        ref={sidebarRef}
        className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}
        aria-label="Main navigation"
      >
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

      {/* ── Main content ── */}
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
