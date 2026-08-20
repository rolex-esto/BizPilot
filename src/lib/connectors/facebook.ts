import { NormalizedMessageEvent, PlatformCapabilities } from "./types";

export class FacebookMessengerConnector {
  public static readonly capabilities: PlatformCapabilities = {
    messaging: true,
    webhooks: true,
    signatureVerification: true,
    rateLimitPerMinute: 200,
    requiresAppReview: true,
    productionReady: true,
    statusNotes: "Officially supported via Meta Messenger Platform & Graph API.",
  };

  /**
   * Normalizes an incoming Meta Messenger webhook payload into standard NormalizedMessageEvent objects
   */
  public static parseWebhookPayload(payload: any): NormalizedMessageEvent[] {
    const events: NormalizedMessageEvent[] = [];

    if (payload.object !== "page" || !Array.isArray(payload.entry)) {
      return events;
    }

    for (const entry of payload.entry) {
      const pageId = entry.id;
      const time = entry.time ? new Date(entry.time) : new Date();

      if (Array.isArray(entry.messaging)) {
        for (const msgEvent of entry.messaging) {
          const senderId = msgEvent.sender?.id;
          const recipientId = msgEvent.recipient?.id;

          const isEcho = Boolean(msgEvent.message?.is_echo);
          const customerPsid = isEcho ? recipientId : senderId;
          const pageIdResolved = isEcho ? (senderId || pageId) : (recipientId || pageId);

          // Process text or attachment message
          if (msgEvent.message) {
            const messageId = msgEvent.message.mid || `fb_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const textContent = msgEvent.message.text || msgEvent.message.quick_reply?.payload || "";
            let mediaUrl: string | undefined;
            let mediaType: any = undefined;
            let resolvedText = textContent;

            if (Array.isArray(msgEvent.message.attachments) && msgEvent.message.attachments.length > 0) {
              const att = msgEvent.message.attachments[0];
              mediaUrl = att.payload?.url;
              mediaType = att.type?.toUpperCase();

              if (!resolvedText) {
                // Sticker detection:
                // Meta sends stickers as image attachments with a sticker_id.
                // The sticker_id can appear at message.sticker_id or att.payload.sticker_id.
                const stickerId: number | undefined =
                  msgEvent.message.sticker_id ?? att.payload?.sticker_id;

                if (stickerId !== undefined) {
                  // Well-known Facebook Like sticker IDs (small / medium / large)
                  const LIKE_STICKER_IDS = new Set([
                    369239263222822,  // 👍 small
                    369239343222814,  // 👍 medium
                    369239383222810,  // 👍 large
                    369239423222806,  // 👍 extra large
                  ]);
                  resolvedText = LIKE_STICKER_IDS.has(stickerId)
                    ? "👍"                   // Facebook "Like" button
                    : "🎭 Sent a sticker";   // other sticker
                } else {
                  // Regular media attachment — show a readable label with emoji
                  const mediaLabels: Record<string, string> = {
                    IMAGE:    "📷 Sent a photo",
                    VIDEO:    "🎥 Sent a video",
                    AUDIO:    "🎵 Sent a voice message",
                    FILE:     "📎 Sent a file",
                    FALLBACK: "🔗 Sent a link",
                  };
                  resolvedText = mediaLabels[mediaType ?? ""] ?? `📎 Sent an attachment`;
                }
              }
            }

            if (!resolvedText) {
              resolvedText = "[Empty message]";
            }

            events.push({
              platform: "FACEBOOK",
              externalAccountId: pageIdResolved,
              externalThreadId: `fb_thread_${customerPsid}`,
              externalMessageId: messageId,
              senderExternalId: customerPsid,
              senderName: isEcho ? "Store Owner" : (msgEvent.senderName || `Facebook User (${customerPsid?.substring(0, 6) || "Guest"})`),
              direction: isEcho ? "OUTBOUND" : "INBOUND",
              textContent: resolvedText,
              mediaUrl,
              mediaType,
              rawPayload: msgEvent,
              timestamp: time,
            });
          } else if (msgEvent.postback) {
            // Handle Get Started or postback button clicks
            const postbackText = msgEvent.postback.title || msgEvent.postback.payload || "[Button Click]";
            const messageId = `fb_pb_${Date.now()}_${Math.random().toString(36).substring(7)}`;

            events.push({
              platform: "FACEBOOK",
              externalAccountId: pageIdResolved,
              externalThreadId: `fb_thread_${customerPsid}`,
              externalMessageId: messageId,
              senderExternalId: customerPsid,
              senderName: msgEvent.senderName || `Facebook User (${customerPsid?.substring(0, 6) || "Guest"})`,
              direction: "INBOUND",
              textContent: postbackText,
              rawPayload: msgEvent,
              timestamp: time,
            });
          }
        }
      }
    }

    return events;
  }

  /**
   * Prepares payload for official Meta Send API
   */
  public static formatOutboundPayload(recipientPsid: string, text: string) {
    return {
      recipient: { id: recipientPsid },
      messaging_type: "RESPONSE",
      message: { text },
    };
  }
}
