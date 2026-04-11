import styles from "./layout.module.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.root}>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
