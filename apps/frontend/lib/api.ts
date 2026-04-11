const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

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

// ─── Response shapes ────────────────────────────────────────────

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  mfaEnabled: boolean;
  emailVerified: boolean;
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

    forgotPassword: (email: string) =>
      request("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),

    resetPassword: (body: { token: string; password: string }) =>
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

    getProfile: () => request<{ status: string; data: { user: PublicUser } }>("/auth/profile"),
  },
};

export { ApiError };
export type { PublicUser, AuthTokens, AuthResponse };
