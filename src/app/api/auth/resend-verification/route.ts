import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { getVerificationUrl, sendVerificationEmail } from "@/lib/auth/verification";

// In-memory rate limiting store: email -> timestamp of last successful resend
const resendCooldowns = new Map<string, number>();
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

function checkRateLimit(email: string): { allowed: boolean; remainingSeconds: number } {
  const lastResentAt = resendCooldowns.get(email);
  if (!lastResentAt) return { allowed: true, remainingSeconds: 0 };

  const elapsed = Date.now() - lastResentAt;
  if (elapsed < RESEND_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
    return { allowed: false, remainingSeconds };
  }

  return { allowed: true, remainingSeconds: 0 };
}

/**
 * POST /api/auth/resend-verification
 * 
 * Resends the verification email for a pending signup.
 * Rate-limited to 1 request every 60 seconds per email.
 * Generates a new token and updates the expiry.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // Rate limiting check
    const rateLimit = checkRateLimit(cleanEmail);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Please wait ${rateLimit.remainingSeconds} second(s) before requesting another verification email.`,
          code: "RATE_LIMITED",
          retryAfter: rateLimit.remainingSeconds,
        },
        { status: 429 }
      );
    }

    // Find pending signup
    const pending = await prisma.pendingSignup.findUnique({
      where: { email: cleanEmail },
    });

    // Always return success message for non-existent pending accounts (anti-enumeration)
    if (!pending) {
      resendCooldowns.set(cleanEmail, Date.now());
      return NextResponse.json({
        status: "success",
        message: "If a pending signup exists with this email, a new verification link has been sent.",
      });
    }

    // Generate new token and extend expiry (+24h)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.pendingSignup.update({
      where: { id: pending.id },
      data: { verificationToken, expiresAt },
    });

    const verificationUrl = getVerificationUrl(verificationToken);
    const emailSent = await sendVerificationEmail(cleanEmail, pending.name, verificationUrl);

    if (!emailSent) {
      return NextResponse.json(
        {
          error: "We couldn't send the verification email right now. Please try again in a moment.",
          code: "EMAIL_SEND_FAILED",
        },
        { status: 500 }
      );
    }

    // Update cooldown on successful send
    resendCooldowns.set(cleanEmail, Date.now());

    return NextResponse.json({
      status: "success",
      message: "A new verification link has been sent to your email.",
    });
  } catch (error: any) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again in a moment." },
      { status: 500 }
    );
  }
}
