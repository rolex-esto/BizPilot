import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/businesses
 * Returns all registered businesses with owner, plan, and metric counts.
 */
export async function GET(req: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.toLowerCase().trim() || "";

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { ownerName: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const businesses = await prisma.business.findMany({
      where,
      select: {
        id: true,
        name: true,
        ownerName: true,
        email: true,
        contactNumber: true,
        address: true,
        planTier: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            products: true,
            orders: true,
            customers: true,
            conversations: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      status: "success",
      businesses,
    });
  } catch (error: any) {
    console.error("Admin list businesses error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/businesses
 * Update business details or status (e.g., suspend / restore).
 */
export async function PUT(req: NextRequest) {
  try {
    const { user: currentAdmin, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { businessId, name, ownerName, email, contactNumber, address, subscriptionStatus, planTier, approvalRequestId } = body;

    if (!businessId) {
      return NextResponse.json({ error: "Business ID is required" }, { status: 400 });
    }

    const targetBiz = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!targetBiz) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Guard: Changing plan or subscription status requires approval code
    if ((planTier && planTier !== targetBiz.planTier) || (subscriptionStatus && subscriptionStatus !== targetBiz.subscriptionStatus)) {
      if (!approvalRequestId) {
        return NextResponse.json(
          {
            error: "Modifying subscription plans or access levels is a protected action that requires the Admin Approval flow with 6-digit email verification.",
            code: "APPROVAL_REQUIRED",
          },
          { status: 403 }
        );
      }

      const approval = await prisma.adminApprovalRequest.findUnique({
        where: { id: approvalRequestId },
      });

      if (!approval || approval.adminId !== currentAdmin!.id || approval.status !== "VERIFIED") {
        return NextResponse.json(
          { error: "Invalid or unverified approval request for plan modification.", code: "INVALID_APPROVAL" },
          { status: 403 }
        );
      }
    }

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(ownerName ? { ownerName: ownerName.trim() } : {}),
        ...(email !== undefined ? { email: email?.trim() || null } : {}),
        ...(contactNumber !== undefined ? { contactNumber: contactNumber?.trim() || null } : {}),
        ...(address !== undefined ? { address: address?.trim() || null } : {}),
        ...(subscriptionStatus ? { subscriptionStatus } : {}),
        ...(planTier ? { planTier } : {}),
      },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        businessId: updated.id,
        action: "BUSINESS_UPDATED",
        entityType: "Business",
        entityId: updated.id,
        details: `Admin ${currentAdmin?.email} updated business ${updated.name} (Plan: ${updated.planTier}, Status: ${updated.subscriptionStatus})`,
        performedBy: "ADMIN",
      },
    });

    return NextResponse.json({
      status: "success",
      message: `Business "${updated.name}" updated successfully`,
      business: updated,
    });
  } catch (error: any) {
    console.error("Admin update business error:", error);
    return NextResponse.json({ error: "Failed to update business" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/businesses
 * Permanently delete a business tenant and all associated data.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { user: currentAdmin, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const url = new URL(req.url);
    const businessId = url.searchParams.get("id");
    const approvalRequestId = url.searchParams.get("approvalRequestId") || req.headers.get("x-approval-request-id");

    if (!businessId) {
      return NextResponse.json({ error: "Business ID is required" }, { status: 400 });
    }

    if (!approvalRequestId) {
      return NextResponse.json(
        {
          error: "Deleting a business store is a critical action that requires the Admin Approval flow with 6-digit email verification.",
          code: "APPROVAL_REQUIRED",
        },
        { status: 403 }
      );
    }

    // Verify approval request
    const approval = await prisma.adminApprovalRequest.findUnique({
      where: { id: approvalRequestId },
    });

    if (!approval || approval.adminId !== currentAdmin!.id || approval.status !== "VERIFIED" || approval.actionType !== "DELETE_BUSINESS") {
      return NextResponse.json(
        { error: "Invalid or unverified approval request for business deletion.", code: "INVALID_APPROVAL" },
        { status: 403 }
      );
    }

    const targetBiz = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!targetBiz) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Cascade delete business and update owner accounts
    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { businessId },
        data: { businessId: null },
      });
      await tx.adminApprovalRequest.update({
        where: { id: approvalRequestId },
        data: { status: "CONSUMED", consumedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          businessId: null,
          action: "BUSINESS_DELETED",
          entityType: "Business",
          entityId: targetBiz.id,
          details: `Admin ${currentAdmin?.email} deleted store "${targetBiz.name}" (Owner: ${targetBiz.ownerName}) with verified security code.`,
          performedBy: "ADMIN",
        },
      });
      await tx.business.delete({
        where: { id: businessId },
      });
    });

    return NextResponse.json({
      status: "success",
      message: `Business "${targetBiz.name}" and all records have been deleted.`,
    });
  } catch (error: any) {
    console.error("Admin delete business error:", error);
    return NextResponse.json({ error: "Failed to delete business" }, { status: 500 });
  }
}
