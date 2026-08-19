import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/api-guard";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * POST /api/settings/security/sign-out-all
 * 
 * Signs the user out of all devices by clearing all sessions for their user ID.
 * Clears the session cookie on the response.
 */
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    await prisma.session.deleteMany({
      where: { userId: authUser!.id },
    });

    const response = NextResponse.json({
      status: "success",
      message: "You have been signed out of all devices.",
    });

    response.cookies.delete(SESSION_COOKIE_NAME);

    return response;
  } catch (error: any) {
    console.error("Sign out all error:", error);
    return NextResponse.json(
      { error: "Could not sign out of all devices. Please try again." },
      { status: 500 }
    );
  }
}
