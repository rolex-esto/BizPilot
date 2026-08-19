import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/verify-email?token=<token>
 * 
 * Validates the verification token from PendingSignup.
 * On success: creates the real User + Business, deletes the pending record.
 * The user's account only exists in the database AFTER this succeeds.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token || token.length < 32) {
      return NextResponse.json(
        { success: false, error: "Invalid verification link." },
        { status: 400 }
      );
    }

    // Find the pending signup by token
    const pending = await prisma.pendingSignup.findUnique({
      where: { verificationToken: token },
    });

    if (!pending) {
      // Token not found — but maybe it was already used successfully
      // We can't look up which user it belonged to (token is gone),
      // but we give a helpful message either way
      return NextResponse.json(
        { 
          success: false, 
          error: "This verification link has already been used. If you've already verified your email, you can log in now.",
          alreadyVerified: true,
        },
        { status: 400 }
      );
    }

    // Check expiration
    if (pending.expiresAt < new Date()) {
      // Clean up expired record
      await prisma.pendingSignup.delete({ where: { id: pending.id } }).catch(() => {});
      return NextResponse.json(
        { success: false, error: "This verification link has expired. Please sign up again." },
        { status: 400 }
      );
    }

    // Check if someone already registered with this email (race condition protection)
    const existingUser = await prisma.user.findUnique({
      where: { email: pending.email },
    });

    if (existingUser) {
      await prisma.pendingSignup.delete({ where: { id: pending.id } }).catch(() => {});
      return NextResponse.json(
        { success: false, error: "An account with this email already exists. Please log in." },
        { status: 400 }
      );
    }

    // Clean up any orphaned business records for this email (from previous failed attempts)
    const orphanedBusinesses = await prisma.business.findMany({
      where: { email: pending.email },
    });
    for (const ob of orphanedBusinesses) {
      const linkedUser = await prisma.user.findFirst({ where: { businessId: ob.id } });
      if (!linkedUser) {
        // No user linked — safe to delete this orphan
        await prisma.business.delete({ where: { id: ob.id } }).catch(() => {});
      }
    }

    // Create the real User + Business in a transaction
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: pending.storeName,
          ownerName: pending.name,
          email: pending.email,
          contactNumber: pending.contactNumber,
          address: pending.address,
          subscriptionStatus: "TRIAL",
          trialEndsAt,
          settingsJson: JSON.stringify({
            businessModel: "ONLINE_ONLY",
            hasPhysicalStore: false,
            autoSuggestReplies: true,
            trialStartedAt: new Date().toISOString(),
            trialEndsAt: trialEndsAt.toISOString(),
            subscriptionStatus: "TRIAL",
          }),
        },
      });

      await tx.user.create({
        data: {
          email: pending.email,
          passwordHash: pending.passwordHash,
          name: pending.name,
          role: "OWNER",
          businessId: business.id,
          emailVerified: true,
        },
      });

      // Delete the pending signup (token is now consumed)
      await tx.pendingSignup.delete({ where: { id: pending.id } });
    });

    return NextResponse.json({
      success: true,
      message: "Your email has been verified! You can now log in to start your 30-day free trial.",
    });
  } catch (error: any) {
    console.error("Email verification error:", error?.message || error);
    // Provide a more helpful error if it's a known issue
    if (error?.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists. Please try logging in." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Something went wrong verifying your email. Please try signing up again." },
      { status: 500 }
    );
  }
}
