import { NextRequest, NextResponse } from "next/server";
import { validateSessionToken, SESSION_COOKIE_NAME, AuthenticatedUser } from "./session";

export const dynamic = "force-dynamic";

/**
 * API route authentication guard.
 * 
 * Returns the authenticated user or a friendly JSON error response.
 * Centralizes the auth check pattern so it doesn't need to be repeated in every route.
 * 
 * Usage:
 *   const { user, errorResponse } = await requireAuth(req);
 *   if (errorResponse) return errorResponse;
 *   // user is guaranteed to be non-null here
 */
export async function requireAuth(req: NextRequest): Promise<{
  user: AuthenticatedUser | null;
  errorResponse: NextResponse | null;
}> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Please log in to continue.", code: "SESSION_MISSING" },
        { status: 401 }
      ),
    };
  }

  const user = await validateSessionToken(token);

  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Your session has expired. Please log in again.", code: "SESSION_EXPIRED" },
        { status: 401 }
      ),
    };
  }

  return { user, errorResponse: null };
}

/**
 * API route business owner guard.
 * 
 * Returns the authenticated user AND their strictly resolved businessId.
 * Guarantees that requests are bound to the authenticated user's business tenant.
 * Prevents multi-tenant data leakage by deriving businessId directly from the validated session.
 */
export async function requireBusinessAuth(req: NextRequest): Promise<{
  user: AuthenticatedUser | null;
  businessId: string | null;
  errorResponse: NextResponse | null;
}> {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return { user: null, businessId: null, errorResponse };

  // If owner, strictly enforce user.businessId (ignoring any spoofed client params)
  if (user!.businessId) {
    return { user, businessId: user!.businessId, errorResponse: null };
  }

  // If Admin without an assigned store, allow explicit businessId via query/header only if specified
  if (user!.role === "ADMIN") {
    const { searchParams } = new URL(req.url);
    const queryBizId = searchParams.get("businessId") || req.headers.get("x-business-id");
    if (queryBizId) {
      return { user, businessId: queryBizId, errorResponse: null };
    }
    // Return null businessId (empty state for admin on owner pages to prevent global data spillover)
    return { user, businessId: null, errorResponse: null };
  }

  return {
    user,
    businessId: null,
    errorResponse: NextResponse.json(
      { error: "No business account associated with your profile. Please complete setup.", code: "NO_BUSINESS" },
      { status: 403 }
    ),
  };
}

/**
 * API route admin-only guard.
 * 
 * Returns the authenticated ADMIN user or a friendly JSON error response.
 * 
 * Usage:
 *   const { user, errorResponse } = await requireAdmin(req);
 *   if (errorResponse) return errorResponse;
 */
export async function requireAdmin(req: NextRequest): Promise<{
  user: AuthenticatedUser | null;
  errorResponse: NextResponse | null;
}> {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return { user: null, errorResponse };

  if (user!.role !== "ADMIN") {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "You don't have permission to access this area.", code: "FORBIDDEN" },
        { status: 403 }
      ),
    };
  }

  return { user, errorResponse: null };
}
