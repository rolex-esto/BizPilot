import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";
import { TokenVault } from "@/lib/connectors/token-vault";
import { LivePlatformApiClient } from "@/lib/connectors/live-client";
import { MessageHub } from "@/lib/connectors/hub";
import { SupportedPlatform } from "@/lib/connectors/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/channels/sync
 * 
 * On-demand pull sync from Meta Graph API for connected Facebook Pages / Instagram accounts.
 * Ingests any recent messages that may have been delayed or where webhooks were pending setup.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;
    if (!businessId) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const connections = await prisma.platformConnection.findMany({
      where: {
        businessId,
        platform: { in: ["FACEBOOK", "INSTAGRAM"] },
        status: "CONNECTED",
      },
    });

    if (connections.length === 0) {
      return NextResponse.json({
        success: false,
        syncedCount: 0,
        message: "No connected Facebook or Instagram accounts found.",
      });
    }

    const client = new LivePlatformApiClient();
    let totalIngested = 0;

    for (const conn of connections) {
      if (!conn.accessTokenEncrypted || !conn.platformAccountId) continue;

      const rawToken = TokenVault.decrypt(conn.accessTokenEncrypted);
      if (!rawToken) continue;

      const platform = conn.platform as SupportedPlatform;
      const result = await client.fetchRecentPageMessages(
        platform,
        rawToken,
        conn.platformAccountId
      );

      if (result.success && result.messages.length > 0) {
        for (const msg of result.messages) {
          const ingestRes = await MessageHub.ingestMessage({
            businessId,
            platform,
            externalAccountId: conn.platformAccountId,
            externalThreadId: `${platform.toLowerCase()}_thread_${msg.senderId}`,
            externalMessageId: msg.messageId,
            senderExternalId: msg.senderId,
            senderName: msg.senderName,
            direction: msg.direction,
            textContent: msg.text,
            timestamp: msg.timestamp,
            environment: "LIVE",
            sourceType: platform as any,
          });

          if (!ingestRes.isDuplicate) {
            totalIngested++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      syncedCount: totalIngested,
      message: totalIngested > 0 ? `Synced ${totalIngested} new message(s) from connected channels.` : "All channels are up to date.",
    });
  } catch (err: any) {
    console.error("[CHANNELS][SYNC] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
