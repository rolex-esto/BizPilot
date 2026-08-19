import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/config/url";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/account/verify-email-change?token=<token>
 * 
 * Verifies email change token, updates User & Business email, and redirects back to /settings.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token || token.length < 32) {
      return NextResponse.redirect(`${getAppUrl()}/settings?error=invalid_token`);
    }

    // Search businesses for pendingEmailChange with this token
    const businesses = await prisma.business.findMany({
      where: { settingsJson: { contains: token } },
    });

    let targetBusiness = null;
    let pendingData = null;

    for (const b of businesses) {
      try {
        const settings = JSON.parse(b.settingsJson || "{}");
        if (settings.pendingEmailChange && settings.pendingEmailChange.token === token) {
          targetBusiness = b;
          pendingData = settings.pendingEmailChange;
          break;
        }
      } catch {}
    }

    if (!targetBusiness || !pendingData) {
      return NextResponse.redirect(`${getAppUrl()}/settings?error=expired_token`);
    }

    if (new Date(pendingData.expiresAt) < new Date()) {
      // Clean up expired change request
      const settings = JSON.parse(targetBusiness.settingsJson || "{}");
      delete settings.pendingEmailChange;
      await prisma.business.update({
        where: { id: targetBusiness.id },
        data: { settingsJson: JSON.stringify(settings) },
      });
      return NextResponse.redirect(`${getAppUrl()}/settings?error=expired_token`);
    }

    // Check if new email was claimed by someone else in the meantime
    const existing = await prisma.user.findUnique({
      where: { email: pendingData.newEmail },
    });

    if (existing && existing.id !== pendingData.userId) {
      return NextResponse.redirect(`${getAppUrl()}/settings?error=email_taken`);
    }

    // Atomically update user email, business email, and clear pendingEmailChange
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: pendingData.userId },
        data: { email: pendingData.newEmail },
      });

      const settings = JSON.parse(targetBusiness.settingsJson || "{}");
      delete settings.pendingEmailChange;

      await tx.business.update({
        where: { id: targetBusiness.id },
        data: {
          email: pendingData.newEmail,
          settingsJson: JSON.stringify(settings),
        },
      });
    });

    return NextResponse.redirect(`${getAppUrl()}/settings?emailUpdated=true`);
  } catch (error: any) {
    console.error("Verify email change error:", error);
    return NextResponse.redirect(`${getAppUrl()}/settings?error=server_error`);
  }
}
