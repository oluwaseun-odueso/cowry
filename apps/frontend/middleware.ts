import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/verify-mfa",
];

// Paths that are accessible with a token but before MFA/avatar/passcode are set up
const SETUP_PATHS = ["/setup-mfa", "/setup-avatar", "/setup-passcode"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("accessToken")?.value;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isSetup = SETUP_PATHS.some((p) => pathname.startsWith(p));

  // No token on a protected route → redirect to login
  if (!isPublic && !isSetup && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Setup pages require a token; without one, redirect to login
  if (isSetup && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Already authenticated users hitting login or landing → go to dashboard
  if (isPublic && token && (pathname === "/login" || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
