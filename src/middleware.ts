import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js Middleware for BizPilot Authentication
 * 
 * Route protection strategy:
 * - Protected routes redirect unauthenticated users to /login with a returnTo param
 * - Public routes (/, /login, /verify-email, /guide, /simulator) remain accessible
 * - The login page handles its own "already authenticated" redirect via client-side
 *   AuthContext (which validates the session against the DB, avoiding stale-cookie issues)
 * - Prevents open-redirect vulnerabilities by validating returnTo paths
 * 
 * IMPORTANT: Middleware only checks cookie PRESENCE for protected route gating.
 * It does NOT redirect users away from /login based on cookie presence, because
 * the cookie could be stale (session deleted from DB but cookie not yet cleared).
 * The login page handles this correctly via useAuth() which validates against the DB.
 */

const SESSION_COOKIE_NAME = "bizpilot_session";

// Routes that require authentication (cookie must exist)
const PROTECTED_ROUTES = [
  "/inbox",
  "/orders",
  "/calendar",
  "/inventory",
  "/categories",
  "/copilot",
  "/channels",
  "/admin",
];

/**
 * Validates that a returnTo path is safe (internal, relative path only).
 * Prevents open-redirect attacks.
 */
function isValidReturnTo(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//") || path.includes("://")) return false;
  if (path.includes("%2f") || path.includes("%2F")) return false;
  if (path === "/login" || path.startsWith("/login?")) return false;
  if (path.startsWith("/api/")) return false;
  return true;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const hasSessionCookie = !!sessionToken;

  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // If user has NO session cookie and is accessing a protected route, redirect to login
  if (!hasSessionCookie && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const loginUrl = new URL("/login", request.url);
    // Preserve the user's original destination
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // All other routes (including /login, /verify-email, /, /guide, /simulator) are accessible.
  // The login page handles "already authenticated" redirect via client-side useAuth()
  // which validates the session against the database (not just cookie presence).
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
