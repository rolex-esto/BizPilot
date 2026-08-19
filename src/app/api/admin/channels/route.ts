import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/channels
 * Returns platform connections and safe messaging activity summaries across businesses.
 * Secrets, access tokens, and private message contents are NEVER exposed.
 */
export async function GET(req: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const [connections, conversationCounts, totalMessagesCount] = await Promise.all([
      prisma.platformConnection.findMany({
        select: {
          id: true,
          businessId: true,
          platform: true,
          platformAccountId: true,
          platformAccountName: true,
          status: true,
          statusMessage: true,
          lastSyncAt: true,
          createdAt: true,
          updatedAt: true,
          business: {
            select: { id: true, name: true, ownerName: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.conversation.groupBy({
        by: ["platform"],
        _count: {
          id: true,
        },
      }),
      prisma.message.count(),
    ]);

    const activitySummary = {
      totalConversations: conversationCounts.reduce((acc, curr) => acc + curr._count.id, 0),
      totalMessagesLogged: totalMessagesCount,
      platformBreakdown: conversationCounts.map((c) => ({
        platform: c.platform,
        conversationsCount: c._count.id,
        deliveryStatus: "Operational",
      })),
    };

    return NextResponse.json({
      status: "success",
      connections,
      activitySummary,
    });
  } catch (error: any) {
    console.error("Admin list channels error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/channels
 * Administrative channel connection status update.
 */
export async function PUT(req: NextRequest) {
  try {
    const { user: currentAdmin, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { connectionId, status } = body;

    if (!connectionId) {
      return NextResponse.json({ error: "Connection ID is required" }, { status: 400 });
    }

    const updated = await prisma.platformConnection.update({
      where: { id: connectionId },
      data: {
        ...(status ? { status } : {}),
      },
      select: {
        id: true,
        platform: true,
        status: true,
        businessId: true,
      },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        businessId: updated.businessId,
        action: "CHANNEL_STATUS_UPDATED",
        entityType: "PlatformConnection",
        entityId: updated.id,
        details: `Admin ${currentAdmin?.email} updated ${updated.platform} channel status to ${updated.status}`,
        performedBy: "ADMIN",
      },
    });

    return NextResponse.json({
      status: "success",
      message: `Channel connection status updated to ${updated.status}`,
      connection: updated,
    });
  } catch (error: any) {
    console.error("Admin update channel error:", error);
    return NextResponse.json({ error: "Failed to update channel" }, { status: 500 });
  }
}
