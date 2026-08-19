import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { getResetPasswordUrl, sendPasswordResetEmail } from "@/lib/auth/password-reset";

// In-memory rate limiting store: email -> timestamp of last request
const resetCooldowns = new Map<string, number>();
const RESET_COOLDOWN_MS = 60 * 1000; // 60 seconds

function checkRateLimit(email: string): { allowed: boolean; remainingSeconds: number } {
  const lastRequestedAt = resetCooldowns.get(email);
  if (!lastRequestedAt) return { allowed: true, remainingSeconds: 0 };

  const elapsed = Date.now() - lastRequestedAt;
  if (elapsed < RESET_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((RESET_COOLDOWN_MS - elapsed) / 1000);
    return { allowed: false, remainingSeconds };
  }

  return { allowed: true, remainingSeconds: 0 };
}

/**
 * POST /api/auth/forgot-password
 * 
 * Requests a password reset link for a verified user account.
 * Rate-limited to 1 request per 60 seconds per email.
 * Always returns a generic success message to prevent email enumeration.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check rate limit
    const rateLimit = checkRateLimit(cleanEmail);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Please wait ${rateLimit.remainingSeconds} second(s) before requesting another reset link.`,
          code: "RATE_LIMITED",
          retryAfter: rateLimit.remainingSeconds,
        },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    // Anti-enumeration: if user not found, apply cooldown and return success
    if (!user) {
      resetCooldowns.set(cleanEmail, Date.now());
      return NextResponse.json({
        status: "success",
        message: "If an account with that email exists, we've sent password reset instructions.",
      });
    }

    // Generate secure 32-byte hex token (256-bit entropy)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Create or update PasswordResetToken
    await prisma.passwordResetToken.upsert({
      where: { email: cleanEmail },
      update: { token, expiresAt },
      create: { email: cleanEmail, token, expiresAt },
    });

    const resetUrl = getResetPasswordUrl(token);
    const emailSent = await sendPasswordResetEmail(cleanEmail, user.name, resetUrl);

    if (!emailSent) {
      return NextResponse.json(
        {
          error: "We couldn't send the password reset email right now. Please try again in a moment.",
          code: "EMAIL_SEND_FAILED",
        },
        { status: 500 }
      );
    }

    resetCooldowns.set(cleanEmail, Date.now());

    return NextResponse.json({
      status: "success",
      message: "If an account with that email exists, we've sent password reset instructions.",
    });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again in a moment." },
      { status: 500 }
    );
  }
}
