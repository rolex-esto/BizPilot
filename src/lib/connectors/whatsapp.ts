import {
  NormalizedMessageEvent,
  PlatformCapabilities,
  MessageType,
  MediaType,
  MediaMetadata,
  LocationMetadata,
  getCanonicalExternalThreadId,
} from "./types";

export class WhatsAppConnector {
  public static readonly capabilities: PlatformCapabilities = {
    messaging: true,
    webhooks: true,
    signatureVerification: true,
    rateLimitPerMinute: 80,
    requiresAppReview: false,
    productionReady: true,
    statusNotes: "Officially supported via Meta WhatsApp Business Cloud API.",
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
    reconciliation: false,
    reconciliationNotes: "WhatsApp Cloud API is push-only via Webhooks; Meta does not provide a conversation pull API for WABA numbers.",
  };

  public static parseWebhookPayload(payload: any): NormalizedMessageEvent[] {
    const events: NormalizedMessageEvent[] = [];

    if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
      return events;
    }

    for (const entry of payload.entry) {
      const wabaId = entry.id;

      if (Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          const value = change.value;
          if (value && Array.isArray(value.messages)) {
            const contacts = value.contacts || [];
            const contactMap: Record<string, string> = {};
            for (const c of contacts) {
              contactMap[c.wa_id] = c.profile?.name || c.wa_id;
            }

            for (const msg of value.messages) {
              const fromNumber = msg.from;
              if (!fromNumber) continue;

              const senderName = contactMap[fromNumber] || `WhatsApp (+${fromNumber})`;
              const messageId = msg.id || `wa_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
              const time = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date();

              let textContent = "";
              let mediaUrl: string | undefined;
              let mediaType: MediaType | undefined;
              let messageType: MessageType = "TEXT";
              let mediaMetadata: MediaMetadata | undefined;
              let locationMetadata: LocationMetadata | undefined;

              const rawType = msg.type || "text";

              if (rawType === "text" && msg.text?.body) {
                textContent = msg.text.body;
                messageType = "TEXT";
              } else if (rawType === "image") {
                messageType = "IMAGE";
                mediaType = "IMAGE";
                mediaUrl = msg.image?.id ? `/api/media/proxy?platform=WHATSAPP&mediaId=${encodeURIComponent(msg.image.id)}` : msg.image?.url;
                mediaMetadata = {
                  mediaId: msg.image?.id,
                  mimeType: msg.image?.mime_type || "image/jpeg",
                  sha256: msg.image?.sha256,
                };
                textContent = msg.image?.caption || "📷 Sent a photo";
              } else if (rawType === "video") {
                messageType = "VIDEO";
                mediaType = "VIDEO";
                mediaUrl = msg.video?.id ? `/api/media/proxy?platform=WHATSAPP&mediaId=${encodeURIComponent(msg.video.id)}` : msg.video?.url;
                mediaMetadata = {
                  mediaId: msg.video?.id,
                  mimeType: msg.video?.mime_type || "video/mp4",
                  sha256: msg.video?.sha256,
                };
                textContent = msg.video?.caption || "🎥 Sent a video";
              } else if (rawType === "audio" || rawType === "voice") {
                messageType = "AUDIO";
                mediaType = "AUDIO";
                mediaUrl = msg.audio?.id ? `/api/media/proxy?platform=WHATSAPP&mediaId=${encodeURIComponent(msg.audio.id)}` : msg.audio?.url;
                mediaMetadata = {
                  mediaId: msg.audio?.id,
                  mimeType: msg.audio?.mime_type || "audio/ogg",
                  sha256: msg.audio?.sha256,
                };
                textContent = msg.audio?.voice ? "🎵 Sent a voice message" : "🎵 Sent an audio message";
              } else if (rawType === "document") {
                messageType = "DOCUMENT";
                mediaType = "DOCUMENT";
                const filename = msg.document?.filename || "document.pdf";
                mediaUrl = msg.document?.id ? `/api/media/proxy?platform=WHATSAPP&mediaId=${encodeURIComponent(msg.document.id)}` : msg.document?.url;
                mediaMetadata = {
                  mediaId: msg.document?.id,
                  mimeType: msg.document?.mime_type || "application/pdf",
                  filename,
                  sha256: msg.document?.sha256,
                };
                textContent = msg.document?.caption || `📎 Sent a file: ${filename}`;
              } else if (rawType === "sticker") {
                messageType = "STICKER";
                mediaUrl = msg.sticker?.id ? `/api/media/proxy?platform=WHATSAPP&mediaId=${encodeURIComponent(msg.sticker.id)}` : msg.sticker?.url;
                mediaMetadata = {
                  mediaId: msg.sticker?.id,
                  mimeType: msg.sticker?.mime_type || "image/webp",
                  animated: Boolean(msg.sticker?.animated),
                };
                textContent = "🎭 Sent a sticker";
              } else if (rawType === "location" && msg.location) {
                messageType = "LOCATION";
                locationMetadata = {
                  latitude: msg.location.latitude,
                  longitude: msg.location.longitude,
                  name: msg.location.name || "Shared Location",
                  address: msg.location.address,
                };
                textContent = `📍 Shared location: ${msg.location.name ? `${msg.location.name} - ` : ""}${msg.location.address || `(${msg.location.latitude.toFixed(4)}, ${msg.location.longitude.toFixed(4)})`}`;
              } else if (rawType === "interactive" && msg.interactive) {
                messageType = "SYSTEM";
                const replyTitle = msg.interactive.button_reply?.title || msg.interactive.list_reply?.title || "[Button Response]";
                textContent = `🔘 Selected option: "${replyTitle}"`;
              } else if (rawType === "button" && msg.button) {
                messageType = "SYSTEM";
                textContent = `🔘 Selected button: "${msg.button.text || msg.button.payload || "Option"}"`;
              } else {
                messageType = "UNKNOWN";
                textContent = `[${rawType} message]`;
              }

              events.push({
                platform: "WHATSAPP",
                externalAccountId: wabaId,
                externalThreadId: getCanonicalExternalThreadId("WHATSAPP", fromNumber),
                externalMessageId: messageId,
                senderExternalId: fromNumber,
                senderName: senderName,
                senderPhone: `+${fromNumber}`,
                direction: "INBOUND",
                messageType,
                textContent,
                mediaUrl,
                mediaType,
                mediaMetadata,
                locationMetadata,
                rawPayload: msg,
                timestamp: time,
              });
            }
          }
        }
      }
    }

    return events;
  }

  /**
   * Prepares payload for official WhatsApp Cloud API
   */
  public static formatOutboundPayload(
    recipientPhone: string,
    content: {
      text?: string;
      mediaUrl?: string;
      mediaType?: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
      filename?: string;
    }
  ) {
    const to = recipientPhone.replace(/^\+/, "").trim();

    if (content.mediaUrl && content.mediaType) {
      if (content.mediaType === "IMAGE") {
        return {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "image",
          image: { link: content.mediaUrl, caption: content.text || undefined },
        };
      }
      if (content.mediaType === "VIDEO") {
        return {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "video",
          video: { link: content.mediaUrl, caption: content.text || undefined },
        };
      }
      if (content.mediaType === "AUDIO") {
        return {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "audio",
          audio: { link: content.mediaUrl },
        };
      }
      if (content.mediaType === "DOCUMENT") {
        return {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "document",
          document: {
            link: content.mediaUrl,
            caption: content.text || undefined,
            filename: content.filename || "document.pdf",
          },
        };
      }
    }

    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: content.text || "" },
    };
  }
}
