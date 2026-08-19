import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/api-guard";
import { createApprovalRequest, AdminApprovalAction } from "@/lib/auth/admin-approval";

export const dynamic = "force-dynamic";

const VALID_CRITICAL_ACTIONS: AdminApprovalAction[] = [
  "GRANT_ADMIN",
  "REVOKE_ADMIN",
  "GRANT_LIFETIME",
  "REVOKE_LIFETIME",
  "DELETE_USER",
  "DELETE_BUSINESS",
  "CHANGE_PLAN",
  "EXTEND_TRIAL",
  "RESET_TRIAL",
  "SET_SUBSCRIPTION_STATUS",
];

/**
 * POST /api/admin/approval/request
 * Initiates an approval request for a protected action and sends OTP to the authorized admin email.
 */
export async function POST(req: NextRequest) {
  try {
    const { user: currentAdmin, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { actionType, targetEmail, targetId, metadata } = body;

    if (!actionType || !VALID_CRITICAL_ACTIONS.includes(actionType)) {
      return NextResponse.json(
        { error: `Invalid action type. Must be one of: ${VALID_CRITICAL_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    if (!targetEmail || !targetEmail.includes("@")) {
      return NextResponse.json({ error: "Please provide a valid target email address." }, { status: 400 });
    }

    const cleanEmail = targetEmail.toLowerCase().trim();

    // Verify recipient existence and build preview
    let targetName = "";
    let previewDetails: any = {};

    if (actionType === "GRANT_ADMIN" || actionType === "REVOKE_ADMIN" || actionType === "DELETE_USER") {
      const user = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });

      if (!user) {
        return NextResponse.json(
          { error: `No user account found with email "${cleanEmail}".` },
          { status: 404 }
        );
      }

      if (actionType === "GRANT_ADMIN" && user.role === "ADMIN") {
        return NextResponse.json(
          { error: `Account "${cleanEmail}" is already an Administrator.` },
          { status: 400 }
        );
      }

      if (actionType === "REVOKE_ADMIN" && user.role !== "ADMIN") {
        return NextResponse.json(
          { error: `Account "${cleanEmail}" is not an Administrator.` },
          { status: 400 }
        );
      }

      if ((actionType === "REVOKE_ADMIN" || actionType === "DELETE_USER") && user.role === "ADMIN") {
        const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
        if (adminCount <= 1) {
          return NextResponse.json(
            { error: "Cannot modify or delete the last remaining administrator account." },
            { status: 400 }
          );
        }
      }

      let bizName = "None";
      if (user.businessId) {
        const userBiz = await prisma.business.findUnique({ where: { id: user.businessId }, select: { name: true } });
        if (userBiz) bizName = userBiz.name;
      }

      targetName = user.name;
      previewDetails = {
        name: user.name,
        email: user.email,
        currentRole: user.role === "ADMIN" ? "Administrator" : "Business Owner",
        businessName: bizName,
        actionType,
        targetId: user.id,
      };
    } else {
      // Business actions: GRANT_LIFETIME, REVOKE_LIFETIME, DELETE_BUSINESS, CHANGE_PLAN, EXTEND_TRIAL, RESET_TRIAL, SET_SUBSCRIPTION_STATUS
      let biz = targetId
        ? await prisma.business.findUnique({ where: { id: targetId } })
        : null;

      if (!biz) {
        biz = await prisma.business.findFirst({
          where: { email: cleanEmail },
        });
      }

      if (!biz) {
        const userWithBiz = await prisma.user.findUnique({
          where: { email: cleanEmail },
        });
        if (userWithBiz?.businessId) {
          biz = await prisma.business.findUnique({ where: { id: userWithBiz.businessId } });
        }
      }

      if (!biz) {
        return NextResponse.json(
          { error: `No business found associated with email "${cleanEmail}".` },
          { status: 404 }
        );
      }

      if (actionType === "GRANT_LIFETIME" && (biz.isLifetimeFree || biz.subscriptionStatus === "LIFETIME")) {
        return NextResponse.json(
          { error: `Store "${biz.name}" already has Lifetime Access.` },
          { status: 400 }
        );
      }

      targetName = biz.name;
      previewDetails = {
        name: biz.name,
        ownerName: biz.ownerName,
        email: biz.email || cleanEmail,
        currentPlan: `${biz.planTier} (${biz.subscriptionStatus})`,
        currentPlanTier: biz.planTier,
        currentSubscriptionStatus: biz.subscriptionStatus,
        businessId: biz.id,
        actionType,
        metadata: metadata || null,
      };
    }

    // Merge metadata details into preview
    if (metadata) {
      if (metadata.requestedPlan) {
        previewDetails.requestedPlan = metadata.requestedPlan;
      }
      if (metadata.requestedStatus) {
        previewDetails.requestedStatus = metadata.requestedStatus;
      }
      if (metadata.extensionDays) {
        previewDetails.extensionDays = metadata.extensionDays;
      }
    }

    // Create approval challenge & send email
    const result = await createApprovalRequest({
      adminId: currentAdmin!.id,
      adminEmail: currentAdmin!.email,
      actionType: actionType as AdminApprovalAction,
      targetEmail: cleanEmail,
      targetId: previewDetails.businessId || previewDetails.targetId || targetId,
      targetName,
      metadata: metadata || {
        currentPlan: previewDetails.currentPlanTier,
        currentStatus: previewDetails.currentSubscriptionStatus,
      },
    });

    if (result.error) {
      return NextResponse.json({ error: result.error, cooldownRemaining: result.cooldownRemaining }, { status: 429 });
    }

    return NextResponse.json({
      status: "success",
      message: `Security code sent to the authorized Admin email.`,
      requestId: result.requestId,
      actionType: result.actionType,
      targetEmail: result.targetEmail,
      targetName: result.targetName,
      metadata: result.metadata,
      expiresAt: result.expiresAt,
      authorizedAdminEmail: result.authorizedAdminEmail,
      preview: previewDetails,
    });
  } catch (error: any) {
    console.error("Admin approval request error:", error);
    return NextResponse.json({ error: "Failed to initiate approval request." }, { status: 500 });
  }
}
