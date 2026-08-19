import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/api-guard";
import crypto from "crypto";
import { getAppUrl } from "@/lib/config/url";
import { sendEmail } from "@/lib/email";

/**
 * PUT /api/settings/account
 * 
 * Updates user account profile (name, phone number).
 * If a new email is provided:
 * - Generates verification token
 * - Stores in business settings as pending email change
 * - Sends verification email to NEW address
 * - Does NOT change verified email until link is clicked.
 */
export async function PUT(req: NextRequest) {
  try {
    const { user: authUser, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { name, email, contactNumber } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Please enter your name." },
        { status: 400 }
      );
    }

    const cleanName = name.trim();
    const cleanEmail = email ? email.toLowerCase().trim() : null;
    const cleanPhone = contactNumber ? contactNumber.trim() : null;

    // Load current user
    const currentUser = await prisma.user.findUnique({
      where: { id: authUser!.id },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    let emailChangeRequested = false;
    let emailChangeMessage = "";

    // Guard: Prevent direct email bypass without 2-step verification
    if (cleanEmail && cleanEmail !== currentUser.email.toLowerCase().trim()) {
      return NextResponse.json(
        {
          error: "Changing your login email requires the secure 2-step verification flow. Please click 'Change Email' in Account settings.",
          code: "USE_EMAIL_CHANGE_FLOW",
        },
        { status: 400 }
      );
    }

    // Update User Name and Business Owner Name / Contact
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: currentUser.id },
        data: { name: cleanName },
      });

      if (currentUser.businessId) {
        await tx.business.update({
          where: { id: currentUser.businessId },
          data: {
            ownerName: cleanName,
            ...(cleanPhone ? { contactNumber: cleanPhone } : {}),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          businessId: currentUser.businessId || null,
          action: "ACCOUNT_PROFILE_UPDATED",
          entityType: "User",
          entityId: currentUser.id,
          details: `User ${cleanName} (${currentUser.email}) updated profile details.`,
          performedBy: "OWNER",
        },
      });
    });

    return NextResponse.json({
      status: "success",
      message: "Your profile information has been updated.",
    });
  } catch (error: any) {
    console.error("Update account error:", error);
    return NextResponse.json(
      { error: "We couldn't save your account changes. Please try again." },
      { status: 500 }
    );
  }
}
