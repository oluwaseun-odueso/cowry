"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { api, scheduleProactiveRefresh, type PublicUser } from "./api";

interface AuthState {
  user: PublicUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (tokens: { accessToken: string; refreshToken: string; expiresIn?: number }, user: PublicUser) => void;
  logout: () => Promise<void>;
  setUser: (user: PublicUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    // Decode the JWT exp claim and seed the proactive refresh chain
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const remainingSeconds = payload.exp - Date.now() / 1000;
      if (remainingSeconds > 0) scheduleProactiveRefresh(remainingSeconds);
    } catch {
      // malformed token — let getProfile fail and clear it below
    }

    api.auth
      .getProfile()
      .then(({ data }) => {
        document.cookie = `accessToken=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        setState({ user: data.user, isLoading: false, isAuthenticated: true });
      })
      .catch(() => {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        document.cookie = "accessToken=; path=/; max-age=0; SameSite=Lax";
        setState({ user: null, isLoading: false, isAuthenticated: false });
      });
  }, []);

  const login = useCallback(
    (tokens: { accessToken: string; refreshToken: string; expiresIn?: number }, user: PublicUser) => {
      localStorage.setItem("accessToken", tokens.accessToken);
      localStorage.setItem("refreshToken", tokens.refreshToken);
      document.cookie = `accessToken=${tokens.accessToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      // Seed the self-rescheduling refresh chain — api.ts takes it from here
      scheduleProactiveRefresh(tokens.expiresIn ?? 900);
      setState({ user, isLoading: false, isAuthenticated: true });
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore — clear tokens regardless
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      document.cookie = "accessToken=; path=/; max-age=0; SameSite=Lax";
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  const setUser = useCallback((user: PublicUser) => {
    setState((s) => ({ ...s, user }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
