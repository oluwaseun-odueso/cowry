"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { api, refreshAccessToken, type PublicUser } from "./api";

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

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Schedule a silent token refresh 2 minutes before expiry.
  // expiresInSeconds is the remaining lifetime of the current access token.
  const scheduleRefresh = useCallback((expiresInSeconds: number) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const delay = Math.max(0, (expiresInSeconds - 120) * 1000);
    refreshTimer.current = setTimeout(() => {
      refreshAccessToken().catch(() => {/* 401 retry logic in api.ts will handle it */});
    }, delay);
  }, []);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    // Decode the JWT exp claim to schedule a proactive refresh
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const remainingSeconds = payload.exp - Date.now() / 1000;
      if (remainingSeconds > 0) scheduleRefresh(remainingSeconds);
    } catch {
      // malformed token — let getProfile fail and clear it
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

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    (tokens: { accessToken: string; refreshToken: string; expiresIn?: number }, user: PublicUser) => {
      localStorage.setItem("accessToken", tokens.accessToken);
      localStorage.setItem("refreshToken", tokens.refreshToken);
      document.cookie = `accessToken=${tokens.accessToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      if (tokens.expiresIn) scheduleRefresh(tokens.expiresIn);
      setState({ user, isLoading: false, isAuthenticated: true });
    },
    [scheduleRefresh],
  );

  const logout = useCallback(async () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
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
