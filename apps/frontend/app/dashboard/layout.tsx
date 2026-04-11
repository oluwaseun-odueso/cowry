"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import styles from "./layout.module.css";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "?";

  return (
    <div className={styles.shell}>
      <header className={styles.nav}>
        <div className={styles.navLogo}>
          <div className={styles.navLogoMark}>C</div>
          <span className={styles.navLogoWord}>Cowry</span>
        </div>

        <div className={styles.navRight}>
          <div className={styles.avatar} title={user ? `${user.firstName} ${user.lastName}` : ""}>
            {initials}
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
