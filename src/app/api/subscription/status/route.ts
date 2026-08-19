import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription/status
 * 
 * Returns the current subscription/trial status for the authenticated user's business.
 * Used by the TrialExpiredGate component to determine if the trial has expired.
 * Lifetime Access businesses bypass trial and renewal limits permanently.
 */
export async function GET(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;
    const authenticatedUser = user!;

    if (!authenticatedUser.businessId) {
      return NextResponse.json({ status: "NONE", trialDaysLeft: null, isLifetime: false });
    }

    const business = await prisma.business.findUnique({
      where: { id: authenticatedUser.businessId },
      select: {
        subscriptionStatus: true,
        isLifetimeFree: true,
        trialEndsAt: true,
        name: true,
        planTier: true,
      },
    });

    if (!business) {
      return NextResponse.json({ status: "NONE", trialDaysLeft: null, isLifetime: false });
    }

    // Channel Entitlement
    const { SubscriptionEntitlementService } = await import("@/lib/auth/subscription-entitlement");
    const channelEntitlement = await SubscriptionEntitlementService.getChannelEntitlement(authenticatedUser.businessId);

    // Check Lifetime Access
    if (business.isLifetimeFree || business.subscriptionStatus === "LIFETIME") {
      return NextResponse.json({
        status: "LIFETIME",
        trialDaysLeft: null,
        isLifetime: true,
        businessName: business.name,
        planTier: business.planTier || "PRO",
        channelUsage: {
          connectedCount: channelEntitlement.connectedCount,
          maxAllowed: channelEntitlement.maxAllowed,
          remainingSlots: channelEntitlement.remainingSlots,
          canConnectAnother: channelEntitlement.canConnectAnother,
        },
      });
    }

    // Calculate trial days left
    let trialDaysLeft: number | null = null;
    if (business.trialEndsAt) {
      trialDaysLeft = Math.ceil((business.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      trialDaysLeft = Math.max(0, trialDaysLeft);
    }

    // Determine effective status
    let effectiveStatus = business.subscriptionStatus;
    if (effectiveStatus === "TRIAL" && trialDaysLeft !== null && trialDaysLeft <= 0) {
      effectiveStatus = "EXPIRED";
    }

    return NextResponse.json({
      status: effectiveStatus,
      trialDaysLeft,
      isLifetime: false,
      businessName: business.name,
      planTier: business.planTier,
      channelUsage: {
        connectedCount: channelEntitlement.connectedCount,
        maxAllowed: channelEntitlement.maxAllowed,
        remainingSlots: channelEntitlement.remainingSlots,
        canConnectAnother: channelEntitlement.canConnectAnother,
      },
    });
  } catch (error: any) {
    console.error("Subscription status error:", error);
    return NextResponse.json({ error: "Could not check status" }, { status: 500 });
  }
}
