import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/api-guard";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * POST /api/settings/security/change-password
 * 
 * Changes password for logged-in user:
 * - Verifies current password
 * - Validates new password length (>= 6)
 * - Hashes new password using secure scrypt implementation
 * - Updates user passwordHash in database
 * - Invalidates all other active sessions (keeping current session valid)
 */
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const currentToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;

    const body = await req.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Please fill in all password fields." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "New passwords do not match. Please verify and try again." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Your new password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser!.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    // Verify current password
    const isCurrentValid = verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json(
        { error: "The current password you entered is incorrect." },
        { status: 400 }
      );
    }

    const newHash = hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      // Update password hash
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });

      // Revoke all other sessions for security (keep current session)
      if (currentToken) {
        await tx.session.deleteMany({
          where: {
            userId: user.id,
            token: { not: currentToken },
          },
        });
      }
    });

    return NextResponse.json({
      status: "success",
      message: "Your password has been successfully updated.",
    });
  } catch (error: any) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "We couldn't change your password right now. Please try again." },
      { status: 500 }
    );
  }
}
