import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/support
 * List support access sessions.
 */
export async function GET(req: NextRequest) {
  try {
    const { user: currentAdmin, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const url = new URL(req.url);
    const businessId = url.searchParams.get("businessId");

    const now = new Date();

    // Expire any outdated sessions
    await prisma.supportSession.updateMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED" },
    });

    const where: any = {};
    if (businessId) where.businessId = businessId;

    const sessions = await prisma.supportSession.findMany({
      where,
      include: {
        business: {
          select: { id: true, name: true, ownerName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      status: "success",
      sessions,
    });
  } catch (error: any) {
    console.error("Admin get support sessions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/support
 * Start a time-bound, scoped Support Access session.
 */
export async function POST(req: NextRequest) {
  try {
    const { user: currentAdmin, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { businessId, reason, scope, durationMinutes = 30 } = body;

    if (!businessId || !reason?.trim()) {
      return NextResponse.json(
        { error: "Business ID and a clear reason for support access are required." },
        { status: 400 }
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const validDuration = Math.min(Math.max(Number(durationMinutes) || 30, 5), 60); // 5 to 60 mins
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validDuration * 60 * 1000);

    // Create Support Session record
    const session = await prisma.supportSession.create({
      data: {
        adminId: currentAdmin!.id,
        businessId: business.id,
        reason: reason.trim(),
        scope: scope || "ORDERS",
        durationMinutes: validDuration,
        status: "ACTIVE",
        startedAt: now,
        expiresAt,
      },
      include: {
        business: {
          select: { id: true, name: true, ownerName: true },
        },
      },
    });

    // Record high-priority audit log
    await prisma.auditLog.create({
      data: {
        businessId: business.id,
        action: "ADMIN_SUPPORT_SESSION_STARTED",
        entityType: "SupportSession",
        entityId: session.id,
        details: `Support session started by ${currentAdmin?.name || currentAdmin?.email}. Reason: "${reason.trim()}". Scope: ${session.scope}. Duration: ${validDuration} mins.`,
        performedBy: "ADMIN",
      },
    });

    return NextResponse.json({
      status: "success",
      message: `Support access granted for ${business.name} (${validDuration} minutes).`,
      session,
    });
  } catch (error: any) {
    console.error("Admin create support session error:", error);
    return NextResponse.json({ error: "Failed to initiate support session" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/support
 * Revoke an active support access session early.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { user: currentAdmin, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("id");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const session = await prisma.supportSession.findUnique({
      where: { id: sessionId },
      include: { business: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Support session not found" }, { status: 404 });
    }

    const updated = await prisma.supportSession.update({
      where: { id: sessionId },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        businessId: session.businessId,
        action: "ADMIN_SUPPORT_SESSION_REVOKED",
        entityType: "SupportSession",
        entityId: session.id,
        details: `Support session manually ended early by ${currentAdmin?.name || currentAdmin?.email}.`,
        performedBy: "ADMIN",
      },
    });

    return NextResponse.json({
      status: "success",
      message: `Support session for ${session.business.name} has been closed.`,
      session: updated,
    });
  } catch (error: any) {
    console.error("Admin revoke support session error:", error);
    return NextResponse.json({ error: "Failed to revoke support session" }, { status: 500 });
  }
}
