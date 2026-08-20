import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/channels/oauth/disconnect
 * Disconnects a platform connection while preserving all historical messages and customer records.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { connectionId, platform } = body;

    if (!connectionId && !platform) {
      return NextResponse.json({ error: "connectionId or platform required." }, { status: 400 });
    }

    const whereClause: any = { businessId };
    if (connectionId) {
      whereClause.id = connectionId;
    } else if (platform) {
      whereClause.platform = platform.toUpperCase();
    }

    const connection = await prisma.platformConnection.findFirst({
      where: whereClause,
    });

    if (!connection) {
      return NextResponse.json({ error: "Platform connection not found." }, { status: 404 });
    }

    const updated = await prisma.platformConnection.update({
      where: { id: connection.id },
      data: {
        status: "DISCONNECTED",
        statusMessage: "Disconnected by store owner. Historical conversations preserved.",
        accessTokenEncrypted: null,
        updatedAt: new Date(),
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        businessId: connection.businessId,
        action: "CHANNEL_DISCONNECTED",
        entityType: "PlatformConnection",
        entityId: connection.id,
        details: `Disconnected ${connection.platform} account: ${connection.platformAccountName}. All past conversations preserved.`,
        performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
      },
    });

    return NextResponse.json({
      status: "success",
      message: `Disconnected ${connection.platformAccountName}. Historical messages remain available in your Inbox.`,
      connection: {
        id: updated.id,
        platform: updated.platform,
        status: updated.status,
      },
    });
  } catch (err: any) {
    console.error("Disconnect error:", err.message);
    return NextResponse.json({ error: err.message || "Failed to disconnect channel." }, { status: 500 });
  }
}
