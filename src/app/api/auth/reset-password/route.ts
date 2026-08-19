import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/reset-password?token=<token>
 * 
 * Verifies if a reset token is valid and unexpired before rendering the form.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token || token.length < 32) {
      return NextResponse.json(
        { valid: false, error: "Invalid password reset link." },
        { status: 400 }
      );
    }

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetRecord) {
      return NextResponse.json(
        { valid: false, error: "This password reset link is invalid or has already been used." },
        { status: 400 }
      );
    }

    if (resetRecord.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: resetRecord.id } }).catch(() => {});
      return NextResponse.json(
        { valid: false, error: "This password reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch (error: any) {
    console.error("Validate reset token error:", error);
    return NextResponse.json(
      { valid: false, error: "Could not validate reset link." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/reset-password
 * 
 * Resets user password using a valid token.
 * On success, updates user passwordHash, invalidates reset token, and clears active sessions.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = body;

    if (!token || typeof token !== "string" || token.length < 32) {
      return NextResponse.json(
        { error: "Invalid or missing password reset token." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetRecord) {
      return NextResponse.json(
        { error: "This password reset link is invalid or has already been used. Please request a new one." },
        { status: 400 }
      );
    }

    if (resetRecord.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: resetRecord.id } }).catch(() => {});
      return NextResponse.json(
        { error: "This password reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: resetRecord.email },
    });

    if (!user) {
      await prisma.passwordResetToken.delete({ where: { id: resetRecord.id } }).catch(() => {});
      return NextResponse.json(
        { error: "No account found associated with this reset link." },
        { status: 404 }
      );
    }

    const passwordHash = hashPassword(password);

    // Atomically update password, delete reset token, and clear existing sessions
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      await tx.passwordResetToken.delete({
        where: { id: resetRecord.id },
      });

      await tx.session.deleteMany({
        where: { userId: user.id },
      });
    });

    return NextResponse.json({
      status: "success",
      message: "Your password has been successfully reset. You can now log in with your new password.",
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Could not reset your password. Please try again." },
      { status: 500 }
    );
  }
}
