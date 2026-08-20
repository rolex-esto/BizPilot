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

            if (Array.isArray(msgEvent.message.attachments) && msgEvent.message.attachments.length > 0) {
              const att = msgEvent.message.attachments[0];
              mediaUrl = att.payload?.url;
              mediaType = att.type?.toUpperCase();
            }

            events.push({
              platform: "FACEBOOK",
              externalAccountId: pageIdResolved,
              externalThreadId: `fb_thread_${customerPsid}`,
              externalMessageId: messageId,
              senderExternalId: customerPsid,
              senderName: isEcho ? "Store Owner" : (msgEvent.senderName || `Facebook User (${customerPsid?.substring(0, 6) || "Guest"})`),
              direction: isEcho ? "OUTBOUND" : "INBOUND",
              textContent: textContent || (mediaUrl ? `[Attachment: ${mediaType}]` : "[Empty message]"),
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
