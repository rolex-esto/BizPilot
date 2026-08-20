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
            let mediaUrl: string | undefined;
            let mediaType: MediaType | undefined;
            let messageType: MessageType = "TEXT";
            let mediaMetadata: MediaMetadata | undefined;
            let resolvedText = textContent;

            if (Array.isArray(msgEvent.message.attachments) && msgEvent.message.attachments.length > 0) {
              const att = msgEvent.message.attachments[0];
              const rawType = (att.type || "").toLowerCase();
              const payloadData = att.payload || {};

              if (rawType === "image" || rawType === "story_mention") {
                mediaUrl = payloadData.url;
                mediaType = "IMAGE";
                messageType = "IMAGE";
                if (!resolvedText) resolvedText = rawType === "story_mention" ? "📸 Mentioned you in a story" : "📷 Sent a photo";
                mediaMetadata = { url: mediaUrl, mimeType: "image/jpeg" };
              } else if (rawType === "video" || rawType === "reel" || rawType === "ig_reel") {
                mediaUrl = payloadData.url;
                mediaType = "VIDEO";
                messageType = "VIDEO";
                if (!resolvedText) resolvedText = rawType.includes("reel") ? "🎥 Shared a Reel" : "🎥 Sent a video";
                mediaMetadata = { url: mediaUrl, mimeType: "video/mp4" };
              } else if (rawType === "audio" || rawType === "voice") {
                mediaUrl = payloadData.url;
                mediaType = "AUDIO";
                messageType = "AUDIO";
                if (!resolvedText) resolvedText = "🎵 Sent a voice message";
                mediaMetadata = { url: mediaUrl, mimeType: "audio/aac" };
              } else if (rawType === "share") {
                mediaUrl = payloadData.url;
                messageType = "UNKNOWN";
                if (!resolvedText) resolvedText = `🔗 Shared post / link: ${payloadData.url || ""}`;
                mediaMetadata = { url: mediaUrl };
              } else {
                mediaUrl = payloadData.url;
                if (!resolvedText) resolvedText = `📎 Sent an attachment (${rawType || "file"})`;
                mediaMetadata = { url: mediaUrl };
              }
            }

            if (!resolvedText) {
              resolvedText = "[Empty message]";
            }

            events.push({
              platform: "INSTAGRAM",
              externalAccountId: igAccountId,
              externalThreadId: getCanonicalExternalThreadId("INSTAGRAM", customerIgsid),
              externalMessageId: messageId,
              senderExternalId: customerIgsid,
              senderName: isEcho ? "Store Owner" : (msgEvent.senderName || `Instagram User (${customerIgsid?.substring(0, 6) || "Guest"})`),
              direction: isEcho ? "OUTBOUND" : "INBOUND",
              messageType,
              textContent: resolvedText,
              mediaUrl,
              mediaType,
              mediaMetadata,
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
