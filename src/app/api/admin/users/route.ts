import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users
 * Returns list of registered users with account details, verification status, and business association.
 * Passwords and hashes are strictly excluded.
 */
export async function GET(req: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.toLowerCase().trim() || "";
    const roleFilter = url.searchParams.get("role") || "";

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (roleFilter) {
      where.role = roleFilter;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        businessId: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            sessions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Also fetch associated business names
    const businessIds = users.map((u) => u.businessId).filter(Boolean) as string[];
    const businesses = await prisma.business.findMany({
      where: { id: { in: businessIds } },
      select: { id: true, name: true, planTier: true, subscriptionStatus: true },
    });

    const businessMap = new Map(businesses.map((b) => [b.id, b]));

    const enrichedUsers = users.map((u) => ({
      ...u,
      business: u.businessId ? businessMap.get(u.businessId) || null : null,
    }));

    return NextResponse.json({
      status: "success",
      users: enrichedUsers,
    });
  } catch (error: any) {
    console.error("Admin list users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/users
 * Update user account (role or email verification).
 * Protected against downgrading the last remaining administrator.
 */
export async function PUT(req: NextRequest) {
  try {
    const { user: currentAdmin, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { userId, role, emailVerified, name } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Guard: Promoting or Demoting Administrator role requires the secure Admin Approval flow
    if (targetUser.role !== role && (role === "ADMIN" || targetUser.role === "ADMIN")) {
      return NextResponse.json(
        {
          error: "Modifying administrator permissions is a sensitive action that requires the Admin Approval flow with 6-digit email verification.",
          code: "APPROVAL_REQUIRED",
        },
        { status: 403 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(role ? { role } : {}),
        ...(typeof emailVerified === "boolean" ? { emailVerified } : {}),
        ...(name ? { name: name.trim() } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        businessId: true,
        emailVerified: true,
        updatedAt: true,
      },
    });

    // Record audit log
    if (targetUser.businessId) {
      await prisma.auditLog.create({
        data: {
          businessId: targetUser.businessId,
          action: "USER_UPDATED",
          entityType: "User",
          entityId: targetUser.id,
          details: `Admin ${currentAdmin?.email} updated user ${targetUser.email} (Role: ${updated.role}, Verified: ${updated.emailVerified})`,
          performedBy: "ADMIN",
        },
      });
    }

    return NextResponse.json({
      status: "success",
      message: `User ${updated.email} updated successfully`,
      user: updated,
    });
  } catch (error: any) {
    console.error("Admin update user error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users
 * Delete a user.
 * Protected against deleting the last remaining administrator account.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { user: currentAdmin, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const url = new URL(req.url);
    const userId = url.searchParams.get("id");
    const approvalRequestId = url.searchParams.get("approvalRequestId") || req.headers.get("x-approval-request-id");

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (!approvalRequestId) {
      return NextResponse.json(
        {
          error: "Deleting a user account is a critical action that requires the Admin Approval flow with 6-digit email verification.",
          code: "APPROVAL_REQUIRED",
        },
        { status: 403 }
      );
    }

    // Verify approval request
    const approval = await prisma.adminApprovalRequest.findUnique({
      where: { id: approvalRequestId },
    });

    if (!approval || approval.adminId !== currentAdmin!.id || approval.status !== "VERIFIED" || approval.actionType !== "DELETE_USER") {
      return NextResponse.json(
        { error: "Invalid or unverified approval request for user deletion.", code: "INVALID_APPROVAL" },
        { status: 403 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ─── LAST-ADMIN DELETE PROTECTION ───
    if (targetUser.role === "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN" },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          {
            error: "You cannot delete the only administrator account. Create another administrator first.",
            code: "LAST_ADMIN_PROTECTED",
          },
          { status: 400 }
        );
      }
    }

    // Delete user and associated sessions
    await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
      await tx.adminApprovalRequest.update({
        where: { id: approvalRequestId },
        data: { status: "CONSUMED", consumedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          businessId: targetUser.businessId || null,
          action: "USER_DELETED",
          entityType: "User",
          entityId: targetUser.id,
          details: `Admin ${currentAdmin?.email} deleted user ${targetUser.name} (${targetUser.email}) with verified security code.`,
          performedBy: "ADMIN",
        },
      });
    });

    return NextResponse.json({
      status: "success",
      message: `User ${targetUser.email} has been deleted.`,
    });
  } catch (error: any) {
    console.error("Admin delete user error:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
