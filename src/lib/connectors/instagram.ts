import {
  NormalizedMessageEvent,
  PlatformCapabilities,
  MessageType,
  MediaType,
  MediaMetadata,
  getCanonicalExternalThreadId,
} from "./types";

export class InstagramConnector {
  public static readonly capabilities: PlatformCapabilities = {
    messaging: true,
    webhooks: true,
    signatureVerification: true,
    rateLimitPerMinute: 200,
    requiresAppReview: true,
    productionReady: true,
    statusNotes: "Officially supported for Instagram Professional & Business accounts connected to a Facebook Page.",
    inbound: {
      text: true,
      image: true,
      video: true,
      audio: true,
      document: false, // Instagram DMs do not support arbitrary documents
      sticker: true,
      location: false,
    },
    outbound: {
      text: true,
      image: true,
      video: true,
      audio: false,
      document: false,
    },
    reconciliation: true,
    reconciliationNotes: "Incremental time-bounded pull via Meta Graph API /conversations for connected IG accounts.",
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
          const recipientId = msgEvent.recipient?.id;
          const isEcho = Boolean(msgEvent.message?.is_echo);
          const customerIgsid = isEcho ? recipientId : senderId;
          const igAccountId = isEcho ? (senderId || igId) : (recipientId || igId);

          if (!customerIgsid) continue;

          if (msgEvent.message) {
            const messageId = msgEvent.message.mid || `ig_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const textContent = msgEvent.message.text || msgEvent.message.quick_reply?.payload || "";
            const attachmentsList = Array.isArray(msgEvent.message.attachments) ? msgEvent.message.attachments : [];

            if (attachmentsList.length === 0) {
              events.push({
                platform: "INSTAGRAM",
                externalAccountId: igAccountId,
                externalThreadId: getCanonicalExternalThreadId("INSTAGRAM", customerIgsid),
                externalMessageId: messageId,
                senderExternalId: customerIgsid,
                senderName: isEcho ? "Store Owner" : (msgEvent.senderName || `Instagram User (${customerIgsid?.substring(0, 6) || "Guest"})`),
                direction: isEcho ? "OUTBOUND" : "INBOUND",
                messageType: "TEXT",
                textContent: textContent || "[Empty message]",
                rawPayload: msgEvent,
                timestamp: time,
              });
            } else {
              attachmentsList.forEach((att: any, idx: number) => {
                const subMessageId = idx === 0 ? messageId : `${messageId}_att_${idx}`;
                const rawType = (att.type || "").toLowerCase();
                const payloadData = att.payload || {};
                let mediaUrl: string | undefined = payloadData.url;
                let mediaType: MediaType | undefined;
                let messageType: MessageType = "TEXT";
                let mediaMetadata: MediaMetadata | undefined;
                let resolvedText = idx === 0 ? textContent : "";

                if (rawType === "image" || rawType === "story_mention") {
                  mediaType = "IMAGE";
                  messageType = "IMAGE";
                  if (!resolvedText) resolvedText = rawType === "story_mention" ? "📸 Mentioned you in a story" : "📷 Sent a photo";
                  mediaMetadata = { url: mediaUrl, mimeType: "image/jpeg" };
                } else if (rawType === "video" || rawType === "reel" || rawType === "ig_reel") {
                  mediaType = "VIDEO";
                  messageType = "VIDEO";
                  if (!resolvedText) resolvedText = rawType.includes("reel") ? "🎥 Shared a Reel" : "🎥 Sent a video";
                  mediaMetadata = { url: mediaUrl, mimeType: "video/mp4" };
                } else if (rawType === "audio" || rawType === "voice") {
                  mediaType = "AUDIO";
                  messageType = "AUDIO";
                  if (!resolvedText) resolvedText = "🎵 Sent a voice message";
                  mediaMetadata = { url: mediaUrl, mimeType: "audio/aac" };
                } else if (rawType === "share") {
                  messageType = "UNKNOWN";
                  if (!resolvedText) resolvedText = `🔗 Shared post / link: ${payloadData.url || ""}`;
                  mediaMetadata = { url: mediaUrl };
                } else {
                  if (!resolvedText) resolvedText = `📎 Sent an attachment (${rawType || "file"})`;
                  mediaMetadata = { url: mediaUrl };
                }

                events.push({
                  platform: "INSTAGRAM",
                  externalAccountId: igAccountId,
                  externalThreadId: getCanonicalExternalThreadId("INSTAGRAM", customerIgsid),
                  externalMessageId: subMessageId,
                  senderExternalId: customerIgsid,
                  senderName: isEcho ? "Store Owner" : (msgEvent.senderName || `Instagram User (${customerIgsid?.substring(0, 6) || "Guest"})`),
                  direction: isEcho ? "OUTBOUND" : "INBOUND",
                  messageType,
                  textContent: resolvedText || (messageType === "IMAGE" ? "📷 Sent a photo" : "[Attachment]"),
                  mediaUrl,
                  mediaType,
                  mediaMetadata,
                  rawPayload: msgEvent,
                  timestamp: time,
                });
              });
            }
          }
        }
      }
    }

    return events;
  }

  /**
   * Prepares payload for official Instagram Send API
   */
  public static formatOutboundPayload(
    recipientIgsid: string,
    content: {
      text?: string;
      mediaUrl?: string;
      mediaType?: "IMAGE" | "VIDEO";
    }
  ) {
    if (content.mediaUrl && (content.mediaType === "IMAGE" || content.mediaType === "VIDEO")) {
      return {
        recipient: { id: recipientIgsid },
        message: {
          attachment: {
            type: content.mediaType === "IMAGE" ? "image" : "video",
            payload: {
              url: content.mediaUrl,
              is_reusable: true,
            },
          },
        },
      };
    }

    return {
      recipient: { id: recipientIgsid },
      message: { text: content.text || "" },
    };
  }
}
