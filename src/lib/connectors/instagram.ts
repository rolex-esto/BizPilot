import { NormalizedMessageEvent, PlatformCapabilities } from "./types";

export class InstagramConnector {
  public static readonly capabilities: PlatformCapabilities = {
    messaging: true,
    webhooks: true,
    signatureVerification: true,
    rateLimitPerMinute: 200,
    requiresAppReview: true,
    productionReady: true,
    statusNotes: "Officially supported for Instagram Business & Creator accounts connected to a Facebook Page.",
  };

  public static parseWebhookPayload(payload: any): NormalizedMessageEvent[] {
    const events: NormalizedMessageEvent[] = [];

    if (payload.object !== "instagram" || !Array.isArray(payload.entry)) {
      return events;
    }

    for (const entry of payload.entry) {
      const igId = entry.id;
      const time = entry.time ? new Date(entry.time) : new Date();

      if (Array.isArray(entry.messaging)) {
        for (const msgEvent of entry.messaging) {
          const senderId = msgEvent.sender?.id;
          if (msgEvent.message) {
            const messageId = msgEvent.message.mid || `ig_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const textContent = msgEvent.message.text || "";
            let mediaUrl: string | undefined;
            let mediaType: any = undefined;

            if (Array.isArray(msgEvent.message.attachments) && msgEvent.message.attachments.length > 0) {
              const att = msgEvent.message.attachments[0];
              mediaUrl = att.payload?.url;
              mediaType = att.type?.toUpperCase();
            }

            events.push({
              platform: "INSTAGRAM",
              externalAccountId: igId,
              externalThreadId: `ig_thread_${senderId}`,
              externalMessageId: messageId,
              senderExternalId: senderId,
              senderName: msgEvent.senderName || `Instagram User (${senderId?.substring(0, 6) || "Guest"})`,
              direction: "INBOUND",
              textContent: textContent || (mediaUrl ? `[Attachment: ${mediaType}]` : "[Empty message]"),
              mediaUrl,
              mediaType,
              rawPayload: msgEvent,
              timestamp: time,
            });
          }
        }
      }
    }

    return events;
  }
}
