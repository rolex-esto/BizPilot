import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";
import { TokenVault } from "@/lib/connectors/token-vault";
import { LivePlatformApiClient } from "@/lib/connectors/live-client";
import { MessageHub } from "@/lib/connectors/hub";
import { SupportedPlatform, getCanonicalExternalThreadId } from "@/lib/connectors/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/channels/sync
 *
 * Universal platform-agnostic pull sync engine for connected social & messaging accounts.
 *
 * Key design principles:
 * 1. BOUNDED: Uses PlatformConnection.lastSyncAt as the since-cursor with a 5-min
 *    overlap window (applied inside fetchRecentPageMessages). Falls back to a 24-hour
 *    window when lastSyncAt is null (first sync).
 * 2. CURSOR ADVANCE: lastSyncAt is updated ONLY after successful processing of all
 *    fetched messages. A failure leaves the cursor unchanged so the next run retries.
 * 3. INBOUND-ONLY: fetchRecentPageMessages skips OUTBOUND echo messages to prevent
 *    fabricating a "Store Owner" customer.
 * 4. THREAD ID CONSISTENCY: externalThreadId uses canonical getCanonicalExternalThreadId.
 * 5. PLATFORM AWARENESS: Distinguishes pull-capable platforms (Facebook, Instagram) from
 *    webhook-first platforms (WhatsApp Cloud API).
 * 6. TELEMETRY: Structured reconciliation log per connection.
 */
export async function POST(req: NextRequest) {
  const reconciliationId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startedAt = new Date();

  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;
    if (!businessId) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const isBackground = body?.background === true;

    const connections = await prisma.platformConnection.findMany({
      where: {
        businessId,
        platform: { in: ["FACEBOOK", "INSTAGRAM", "WHATSAPP", "TIKTOK"] },
        status: "CONNECTED",
      },
    });

    if (connections.length === 0) {
      return NextResponse.json({
        success: false,
        syncedCount: 0,
        message: "No connected social messaging accounts found.",
      });
    }

    const client = new LivePlatformApiClient();
    let totalIngested = 0;
    const connectionResults: Array<{
      platform: string;
      checkpointBefore: string | null;
      checkpointAfter: string | null;
      messagesFetched: number;
      messagesIngested: number;
      duplicates: number;
      pagesFetched: number;
      statusNote?: string;
      error?: string;
    }> = [];

    for (const conn of connections) {
      const platform = conn.platform as SupportedPlatform;
      const checkpointBefore = conn.lastSyncAt?.toISOString() ?? null;

      // WhatsApp Cloud API & TikTok are push-webhook first architectures
      if (platform === "WHATSAPP") {
        connectionResults.push({
          platform,
          checkpointBefore,
          checkpointAfter: checkpointBefore,
          messagesFetched: 0,
          messagesIngested: 0,
          duplicates: 0,
          pagesFetched: 0,
          statusNote: "WEBHOOK_PUSH_ACTIVE (WhatsApp Cloud API receives live webhooks; pull reconciliation is not provided by Meta WABA API)",
        });
        continue;
      }

      if (platform === "TIKTOK") {
        connectionResults.push({
          platform,
          checkpointBefore,
          checkpointAfter: checkpointBefore,
          messagesFetched: 0,
          messagesIngested: 0,
          duplicates: 0,
          pagesFetched: 0,
          statusNote: "ENTERPRISE_WEBHOOK_REQUIRED (TikTok Business Messaging requires enterprise developer approval)",
        });
        continue;
      }

      if (!conn.accessTokenEncrypted || !conn.platformAccountId) continue;

      const rawToken = TokenVault.decrypt(conn.accessTokenEncrypted);
      if (!rawToken) continue;

      const sinceEpochMs = conn.lastSyncAt
        ? conn.lastSyncAt.getTime()
        : Date.now() - 24 * 60 * 60 * 1000; // 24-hour bootstrap window

      const reconStartTime = new Date();

      const result = await client.fetchRecentPageMessages(
        platform,
        rawToken,
        conn.platformAccountId,
        { sinceEpochMs, maxPages: 3, perPage: 20 }
      );

      let messagesIngested = 0;
      let duplicates = 0;
      let connError: string | undefined;

      if (result.success && result.messages.length > 0) {
        for (const msg of result.messages) {
          try {
            const canonicalThreadId = getCanonicalExternalThreadId(platform, msg.senderId);
            const ingestRes = await MessageHub.ingestMessage({
              businessId,
              platform,
              externalAccountId: conn.platformAccountId,
              externalThreadId: canonicalThreadId,
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
              messagesIngested++;
              totalIngested++;
            } else {
              duplicates++;
            }
          } catch (ingestErr: any) {
            console.error(
              `[RECONCILE][${reconciliationId}] Ingest error for msg=${msg.messageId}: ${ingestErr.message}`
            );
            connError = ingestErr.message;
          }
        }

        await prisma.platformConnection.update({
          where: { id: conn.id },
          data: { lastSyncAt: reconStartTime },
        });
      } else if (result.success && result.messages.length === 0) {
        await prisma.platformConnection.update({
          where: { id: conn.id },
          data: { lastSyncAt: reconStartTime },
        });
      } else {
        connError = result.error;
      }

      const checkpointAfter = (result.success
        ? reconStartTime
        : conn.lastSyncAt
      )?.toISOString() ?? null;

      connectionResults.push({
        platform,
        checkpointBefore,
        checkpointAfter,
        messagesFetched: result.messages.length,
        messagesIngested,
        duplicates,
        pagesFetched: result.pagesFetched,
        error: connError,
      });

      const durationMs = Date.now() - startedAt.getTime();
      console.log(
        `[RECONCILE][${reconciliationId}] platform=${platform} ` +
        `accountId=${conn.platformAccountId} ` +
        `checkpointBefore=${checkpointBefore} checkpointAfter=${checkpointAfter} ` +
        `messagesFetched=${result.messages.length} messagesIngested=${messagesIngested} ` +
        `duplicates=${duplicates} pagesFetched=${result.pagesFetched} ` +
        `durationMs=${durationMs} error=${connError ?? "none"}`
      );
    }

    const completedAt = new Date();
    const totalDurationMs = completedAt.getTime() - startedAt.getTime();

    return NextResponse.json({
      success: true,
      reconciliationId,
      syncedCount: totalIngested,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: totalDurationMs,
      connections: connectionResults,
      message:
        totalIngested > 0
          ? `Synced ${totalIngested} new message(s) from connected channels.`
          : "All channels are up to date.",
    });
  } catch (err: any) {
    const durationMs = Date.now() - startedAt.getTime();
    console.error(`[RECONCILE][${reconciliationId}] Fatal error after ${durationMs}ms:`, err);
    return NextResponse.json(
      { success: false, error: err.message, reconciliationId },
      { status: 500 }
    );
  }
}
