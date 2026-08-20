/**
 * BizPilot Initial Message Restoration Service
 * 
 * Automatically synchronizes recent customer conversations from the connected platform (Meta Graph API)
 * after an account is newly connected via OAuth.
 * Non-blocking, fault-tolerant, and channel-isolated.
 */

import { prisma } from "../prisma";
import { TokenVault } from "./token-vault";
import { MessageHub } from "./hub";
import { getCanonicalExternalThreadId } from "./types";

export interface RestorationSummary {
  conversationsImported: number;
  messagesImported: number;
  status: "COMPLETED" | "PARTIAL" | "FAILED";
  error?: string;
}

export class HistoryRestorer {
  /**
   * Performs an initial historical sync for a newly connected Facebook or Instagram Page.
   * Runs in the background without blocking the UI.
   */
  public static async restoreRecentChannelHistory(
    platformConnectionId: string,
    limitConversations = 10
  ): Promise<RestorationSummary> {
    const conn = await prisma.platformConnection.findUnique({
      where: { id: platformConnectionId },
      include: { business: true },
    });

    if (!conn || !conn.accessTokenEncrypted || conn.status !== "CONNECTED") {
      return { conversationsImported: 0, messagesImported: 0, status: "FAILED", error: "Connection invalid or token missing" };
    }

    const rawToken = TokenVault.decrypt(conn.accessTokenEncrypted);
    if (!rawToken) {
      return { conversationsImported: 0, messagesImported: 0, status: "FAILED", error: "Decryption failed" };
    }

    const platform = conn.platform.toUpperCase();
    let convCount = 0;
    let msgCount = 0;

    // Simulator / Test Mode Handling
    if (rawToken.startsWith("sim_") || rawToken.startsWith("sample_") || process.env.NODE_ENV === "test") {
      // Seed a clean welcome conversation if empty
      const existing = await prisma.conversation.count({ where: { businessId: conn.businessId, platform: conn.platform } });
      if (existing === 0) {
        const cust = await prisma.customer.create({
          data: {
            businessId: conn.businessId,
            name: `${conn.platformAccountName} Buyer`,
            externalId: `cust_${conn.platform.toLowerCase()}_${Date.now()}`,
            primaryPlatform: conn.platform,
            leadScore: 75,
            leadStatus: "WARM",
          },
        });
        const newConv = await prisma.conversation.create({
          data: {
            businessId: conn.businessId,
            platform: conn.platform,
            externalThreadId: getCanonicalExternalThreadId(conn.platform, cust.externalId || "123"),
            customerId: cust.id,
            environment: "LIVE",
            lastMessagePreview: `Hello! I saw your ${conn.platformAccountName} shop.`,
            lastMessageAt: new Date(),
          },
        });
        await prisma.message.create({
          data: {
            conversationId: newConv.id,
            platform: conn.platform,
            direction: "INBOUND",
            textContent: `Hello! I saw your ${conn.platformAccountName} shop. Are items in stock?`,
            externalMessageId: `msg_welcome_${Date.now()}`,
            sentAt: new Date(),
          },
        });
        convCount = 1;
        msgCount = 1;
      }
      return { conversationsImported: convCount, messagesImported: msgCount, status: "COMPLETED" };
    }

    // Live Meta Graph API History Pull
    if (platform === "FACEBOOK" || platform === "INSTAGRAM") {
      try {
        const url = `https://graph.facebook.com/v19.0/${conn.platformAccountId}/conversations?fields=id,snippet,updated_time,participants,messages{id,message,created_time,from,attachments}&limit=${limitConversations}&access_token=${encodeURIComponent(rawToken)}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const data = await res.json();

        if (data.data && Array.isArray(data.data)) {
          for (const thread of data.data) {
            const participants = thread.participants?.data || [];
            const otherParticipant = participants.find((p: any) => p.id !== conn.platformAccountId) || participants[0];
            const senderPsid = otherParticipant?.id || `psid_${thread.id}`;
            const senderName = otherParticipant?.name || "Customer";

            const messagesList = thread.messages?.data || [];
            for (const m of messagesList) {
              const isFromOwner = m.from?.id === conn.platformAccountId;
              const attachments = m.attachments?.data || [];
              const firstImage = attachments.find((a: any) => a.image_data || a.type === "image");
              const mediaUrl = firstImage?.image_data?.url || firstImage?.file_url;

              await MessageHub.ingestMessage({
                platform: platform as any,
                businessId: conn.businessId,
                externalAccountId: conn.platformAccountId,
                externalThreadId: getCanonicalExternalThreadId(platform, senderPsid),
                externalMessageId: m.id,
                senderExternalId: isFromOwner ? conn.platformAccountId : senderPsid,
                senderName: isFromOwner ? "Store Owner" : senderName,
                direction: isFromOwner ? "OUTBOUND" : "INBOUND",
                textContent: m.message || (mediaUrl ? "[Photo]" : ""),
                mediaUrl: mediaUrl || undefined,
                mediaType: mediaUrl ? "IMAGE" : undefined,
                timestamp: m.created_time ? new Date(m.created_time) : new Date(),
                environment: "LIVE",
              });
              msgCount++;
            }
            convCount++;
          }
        }

        await prisma.platformConnection.update({
          where: { id: conn.id },
          data: { lastSyncAt: new Date() },
        });

        return { conversationsImported: convCount, messagesImported: msgCount, status: "COMPLETED" };
      } catch (err: any) {
        console.error("Live Meta history restoration error:", err);
        return { conversationsImported: convCount, messagesImported: msgCount, status: "PARTIAL", error: err.message };
      }
    }

    return { conversationsImported: 0, messagesImported: 0, status: "COMPLETED" };
  }
}
