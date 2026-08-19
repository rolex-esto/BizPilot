import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

/**
 * PUT /api/admin/businesses/[id]/subscription
 * Protected endpoint: Subscription plan and status modifications require the Admin Approval flow with 6-digit email verification.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user: currentAdmin, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const businessId = params.id;
    const body = await req.json();
    const { planTier, subscriptionStatus, isLifetimeFree, approvalRequestId } = body;

    // Verify business exists
    const existing = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Guard: Subscription and access modifications ALWAYS require verified approval request
    if (!approvalRequestId) {
      return NextResponse.json(
        {
          error: "Modifying subscription plans or access levels is a protected action that requires the Admin Approval flow with 6-digit email verification.",
          code: "APPROVAL_REQUIRED",
        },
        { status: 403 }
      );
    }

    // Verify approval request
    const approval = await prisma.adminApprovalRequest.findUnique({
      where: { id: approvalRequestId },
    });

    if (
      !approval ||
      approval.adminId !== currentAdmin!.id ||
      approval.status !== "VERIFIED" ||
      (approval.targetId !== businessId && approval.targetEmail !== existing.email)
    ) {
      return NextResponse.json(
        {
          error: "Invalid or unverified approval request for this business subscription change.",
          code: "INVALID_APPROVAL",
        },
        { status: 403 }
      );
    }

    let updatedPlanTier = planTier || existing.planTier;
    let updatedStatus = subscriptionStatus || existing.subscriptionStatus;
    let updatedTrialEndsAt = existing.trialEndsAt;
    let updatedIsLifetime = existing.isLifetimeFree;

    if (isLifetimeFree || approval.actionType === "GRANT_LIFETIME") {
      updatedPlanTier = "PRO";
      updatedStatus = "LIFETIME";
      updatedIsLifetime = true;
      updatedTrialEndsAt = null;
    } else if (approval.actionType === "REVOKE_LIFETIME") {
      updatedPlanTier = "STARTER";
      updatedStatus = "ACTIVE";
      updatedIsLifetime = false;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const biz = await tx.business.update({
        where: { id: businessId },
        data: {
          planTier: updatedPlanTier,
          subscriptionStatus: updatedStatus,
          isLifetimeFree: updatedIsLifetime,
          trialEndsAt: updatedTrialEndsAt,
        },
      });

      await tx.adminApprovalRequest.update({
        where: { id: approvalRequestId },
        data: { status: "CONSUMED", consumedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          businessId: biz.id,
          action: "SUBSCRIPTION_UPDATED",
          entityType: "Business",
          entityId: biz.id,
          details: `Admin ${currentAdmin?.email} changed ${biz.name}'s plan from ${existing.planTier} (${existing.subscriptionStatus}) to ${updatedPlanTier} (${updatedStatus}) with verified security code.`,
          performedBy: "ADMIN",
        },
      });

      return biz;
    });

    return NextResponse.json({
      status: "success",
      message: `${updated.name} is now using the ${updated.planTier} plan (${updated.subscriptionStatus}).`,
      business: {
        id: updated.id,
        name: updated.name,
        planTier: updated.planTier,
        subscriptionStatus: updated.subscriptionStatus,
        isLifetimeFree: updated.isLifetimeFree,
        trialEndsAt: updated.trialEndsAt,
      },
    });
  } catch (error: any) {
    console.error("Admin update subscription error:", error);
    return NextResponse.json({ error: "Failed to update business subscription" }, { status: 500 });
  }
}
