import {
  NormalizedMessageEvent,
  PlatformCapabilities,
  MessageType,
  MediaType,
  MediaMetadata,
  LocationMetadata,
  getCanonicalExternalThreadId,
} from "./types";

export class FacebookMessengerConnector {
  public static readonly capabilities: PlatformCapabilities = {
    messaging: true,
    webhooks: true,
    signatureVerification: true,
    rateLimitPerMinute: 200,
    requiresAppReview: true,
    productionReady: true,
    statusNotes: "Officially supported via Meta Messenger Platform & Graph API.",
    inbound: {
      text: true,
      image: true,
      video: true,
      audio: true,
      document: true,
      sticker: true,
      location: true,
    },
    outbound: {
      text: true,
      image: true,
      video: true,
      audio: true,
      document: true,
    },
    reconciliation: true,
    reconciliationNotes: "Incremental time-bounded pull via Meta Graph API /conversations with since-cursor.",
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

          if (!customerPsid) continue;

          // Process text or attachment message
          if (msgEvent.message) {
            const messageId = msgEvent.message.mid || `fb_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const textContent = msgEvent.message.text || msgEvent.message.quick_reply?.payload || "";
            let mediaUrl: string | undefined;
            let mediaType: MediaType | undefined;
            let messageType: MessageType = "TEXT";
            let mediaMetadata: MediaMetadata | undefined;
            let locationMetadata: LocationMetadata | undefined;
            let resolvedText = textContent;

            if (Array.isArray(msgEvent.message.attachments) && msgEvent.message.attachments.length > 0) {
              const att = msgEvent.message.attachments[0];
              const rawType = (att.type || "").toLowerCase();
              const payloadData = att.payload || {};

              if (rawType === "image") {
                mediaUrl = payloadData.url;
                mediaType = "IMAGE";
                messageType = "IMAGE";

                // Check for sticker (Meta sends stickers as image attachments with sticker_id)
                const stickerId = msgEvent.message.sticker_id ?? payloadData.sticker_id;
                if (stickerId !== undefined) {
                  messageType = "STICKER";
                  const LIKE_STICKER_IDS = new Set([
                    369239263222822, // 👍 small
                    369239343222814, // 👍 medium
                    369239383222810, // 👍 large
                    369239423222806, // 👍 extra large
                  ]);
                  resolvedText = LIKE_STICKER_IDS.has(stickerId)
                    ? "👍"
                    : (resolvedText || "🎭 Sent a sticker");
                  mediaMetadata = {
                    url: mediaUrl,
                    mediaId: String(stickerId),
                    animated: Boolean(payloadData.animated),
                  };
                } else {
                  if (!resolvedText) resolvedText = "📷 Sent a photo";
                  mediaMetadata = {
                    url: mediaUrl,
                    mimeType: "image/jpeg",
                  };
                }
              } else if (rawType === "video") {
                mediaUrl = payloadData.url;
                mediaType = "VIDEO";
                messageType = "VIDEO";
                if (!resolvedText) resolvedText = "🎥 Sent a video";
                mediaMetadata = { url: mediaUrl, mimeType: "video/mp4" };
              } else if (rawType === "audio") {
                mediaUrl = payloadData.url;
                mediaType = "AUDIO";
                messageType = "AUDIO";
                if (!resolvedText) resolvedText = "🎵 Sent a voice message";
                mediaMetadata = { url: mediaUrl, mimeType: "audio/aac" };
              } else if (rawType === "file") {
                mediaUrl = payloadData.url;
                mediaType = "DOCUMENT";
                messageType = "DOCUMENT";
                const filename = payloadData.title || "attachment";
                if (!resolvedText) resolvedText = `📎 Sent a file: ${filename}`;
                mediaMetadata = { url: mediaUrl, filename };
              } else if (rawType === "location" && payloadData.coordinates) {
                messageType = "LOCATION";
                locationMetadata = {
                  latitude: payloadData.coordinates.lat,
                  longitude: payloadData.coordinates.long,
                  name: payloadData.title || "Shared Location",
                  url: payloadData.url,
                };
                if (!resolvedText) resolvedText = `📍 Shared location (${payloadData.coordinates.lat.toFixed(4)}, ${payloadData.coordinates.long.toFixed(4)})`;
              } else if (rawType === "fallback") {
                messageType = "UNKNOWN";
                mediaUrl = payloadData.url;
                if (!resolvedText) resolvedText = `🔗 Sent a link: ${payloadData.title || payloadData.url || "Attachment"}`;
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
              platform: "FACEBOOK",
              externalAccountId: pageIdResolved,
              externalThreadId: getCanonicalExternalThreadId("FACEBOOK", customerPsid),
              externalMessageId: messageId,
              senderExternalId: customerPsid,
              senderName: isEcho ? "Store Owner" : (msgEvent.senderName || `Facebook User (${customerPsid?.substring(0, 6) || "Guest"})`),
              direction: isEcho ? "OUTBOUND" : "INBOUND",
              messageType,
              textContent: resolvedText,
              mediaUrl,
              mediaType,
              mediaMetadata,
              locationMetadata,
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
              externalThreadId: getCanonicalExternalThreadId("FACEBOOK", customerPsid),
              externalMessageId: messageId,
              senderExternalId: customerPsid,
              senderName: msgEvent.senderName || `Facebook User (${customerPsid?.substring(0, 6) || "Guest"})`,
              direction: "INBOUND",
              messageType: "SYSTEM",
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
   * Prepares payload for official Meta Send API (Text or Media)
   */
  public static formatOutboundPayload(
    recipientPsid: string,
    content: {
      text?: string;
      mediaUrl?: string;
      mediaType?: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
    }
  ) {
    if (content.mediaUrl && content.mediaType) {
      const typeMap: Record<string, string> = {
        IMAGE: "image",
        VIDEO: "video",
        AUDIO: "audio",
        DOCUMENT: "file",
      };
      return {
        recipient: { id: recipientPsid },
        messaging_type: "RESPONSE",
        message: {
          attachment: {
            type: typeMap[content.mediaType] || "file",
            payload: {
              url: content.mediaUrl,
              is_reusable: true,
            },
          },
        },
      };
    }

    return {
      recipient: { id: recipientPsid },
      messaging_type: "RESPONSE",
      message: { text: content.text || "" },
    };
  }
}
