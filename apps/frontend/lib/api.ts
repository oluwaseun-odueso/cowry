const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include", // send httpOnly refresh-token cookie on every request
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({ message: "Unexpected error" }));

  if (!res.ok) {
    throw new ApiError(res.status, data.message ?? "Request failed");
  }

  return data as T;
}

// ─── Shared types ────────────────────────────────────────────────

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  isMfaEnabled: boolean;
  emailVerified: boolean;
  phoneNumber?: string;
  profilePicture?: string | null;
  lastLogin?: string | null;
  createdAt?: string;
}

export interface Account {
  id: string;
  userId: string;
  accountNumber: string;
  accountType: "savings" | "current";
  currency: string;
  balance: number;
  status: "active" | "suspended";
  createdAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  type: "credit" | "debit";
  amount: number;
  currency: string;
  reference: string;
  description?: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
}

export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  reference: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
}

export interface Session {
  id: string;
  ipAddress: string;
  deviceInfo?: { browser?: string; os?: string; device?: string; isMobile?: boolean } | null;
  location?: { country?: string; city?: string } | null;
  createdAt: string;
  expiresAt: string;
}

export interface FraudAlert {
  id: string;
  userId?: string;
  ruleName: string;
  riskLevel: "low" | "medium" | "high";
  description: string;
  ipAddress: string;
  location?: object | null;
  metadata?: object | null;
  action: string;
  isResolved: boolean;
  createdAt: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  status: string;
  data: { user: PublicUser } & Partial<AuthTokens> & {
      mfaRequired?: boolean;
      challengeToken?: string;
    };
}

// ─── API methods ─────────────────────────────────────────────────

export const api = {
  auth: {
    register: (body: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phoneNumber: string;
    }) =>
      request<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    login: (body: { email: string; password: string }) =>
      request<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    refreshToken: (refreshToken: string) =>
      request<AuthResponse>("/auth/refresh-token", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }),

    logout: () => request("/auth/logout", { method: "POST" }),

    logoutAll: () => request("/auth/logout-all", { method: "POST" }),

    forgotPassword: (email: string) =>
      request("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),

    resetPassword: (body: { token: string; password: string; confirmPassword: string }) =>
      request("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    verifyEmail: (token: string) =>
      request("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),

    verifyMfa: (body: { challengeToken: string; code: string }) =>
      request<AuthResponse>("/auth/verify-mfa", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    getProfile: () =>
      request<{ status: string; data: { user: PublicUser } }>("/auth/profile"),

    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      request("/auth/change-password", {
        method: "PUT",
        body: JSON.stringify(body),
      }),

    setupMfa: () =>
      request<{ status: string; data: { otpauthUrl: string; secret: string } }>("/auth/setup-mfa", {
        method: "POST",
      }),

    enableMfa: (code: string) =>
      request<{ status: string; data: { backupCodes: string[] } }>("/auth/enable-mfa", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),

    disableMfa: (code: string) =>
      request("/auth/disable-mfa", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),

    sessions: () =>
      request<{ status: string; data: { sessions: Session[] } }>("/auth/sessions"),

    revokeSession: (sessionId: string) =>
      request(`/auth/sessions/${sessionId}`, { method: "DELETE" }),
  },

  accounts: {
    list: () =>
      request<{ status: string; data: { accounts: Account[] } }>("/accounts"),

    create: (body: { type: "savings" | "current"; currency?: string }) =>
      request<{ status: string; data: { account: Account } }>("/accounts", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    get: (id: string) =>
      request<{ status: string; data: { account: Account } }>(`/accounts/${id}`),

    deposit: (id: string, body: { amount: number; description?: string }) =>
      request<{ status: string; data: { transaction: Transaction; balance: number } }>(
        `/accounts/${id}/deposit`,
        { method: "POST", body: JSON.stringify(body) },
      ),

    withdraw: (id: string, body: { amount: number; description?: string }) =>
      request<{ status: string; data: { transaction: Transaction; balance: number } }>(
        `/accounts/${id}/withdraw`,
        { method: "POST", body: JSON.stringify(body) },
      ),

    transfer: (id: string, body: { toAccountId: string; amount: number; description?: string }) =>
      request<{ status: string; data: { transfer: Transfer; balance: number } }>(
        `/accounts/${id}/transfer`,
        { method: "POST", body: JSON.stringify(body) },
      ),

    transactions: (
      id: string,
      params?: {
        type?: "credit" | "debit";
        from?: string;
        to?: string;
        minAmount?: number;
        maxAmount?: number;
        page?: number;
        limit?: number;
      },
    ) => {
      const qs = params
        ? "?" +
          new URLSearchParams(
            Object.entries(params)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => [k, String(v)]),
          ).toString()
        : "";
      return request<{
        status: string;
        data: { transactions: Transaction[]; pagination: Pagination };
      }>(`/accounts/${id}/transactions${qs}`);
    },

    statement: (id: string, from: string, to: string) =>
      request<{ status: string; data: object }>(
        `/accounts/${id}/statement?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
  },

  transactions: {
    get: (id: string) =>
      request<{ status: string; data: { transaction: Transaction } }>(`/transactions/${id}`),
  },

  admin: {
    users: () =>
      request<{ status: string; data: { users: PublicUser[] } }>("/admin/users"),

    auditLog: (params?: {
      riskLevel?: string;
      isResolved?: string;
      userId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    }) => {
      const qs = params
        ? "?" +
          new URLSearchParams(
            Object.entries(params)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => [k, String(v)]),
          ).toString()
        : "";
      return request<{
        status: string;
        data: { alerts: FraudAlert[]; pagination: Pagination };
      }>(`/admin/audit-log${qs}`);
    },

    resolveAlert: (alertId: string) =>
      request(`/admin/audit-log/${alertId}/resolve`, { method: "PATCH" }),
  },
};

export { ApiError };
export type { AuthTokens, AuthResponse };
