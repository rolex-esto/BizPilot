import {
  NormalizedMessageEvent,
  PlatformCapabilities,
  MessageType,
  getCanonicalExternalThreadId,
} from "./types";

export class TikTokConnector {
  public static readonly capabilities: PlatformCapabilities = {
    messaging: false,
    webhooks: true,
    signatureVerification: true,
    rateLimitPerMinute: 60,
    requiresAppReview: true,
    productionReady: false,
    statusNotes: "RESTRICTED / REQUIRES ENTERPRISE APPROVAL: TikTok Business Messaging API requires approved Enterprise TikTok for Business verification and developer whitelisting for direct messages.",
    inbound: {
      text: true,
      image: false,
      video: false,
      audio: false,
      document: false,
      sticker: false,
      location: false,
    },
    outbound: {
      text: false,
      image: false,
      video: false,
      audio: false,
      document: false,
    },
    reconciliation: false,
    reconciliationNotes: "TikTok Business Messaging does not provide an open conversation pull API; webhooks are gated behind enterprise verification.",
  };

  public static parseWebhookPayload(payload: any): NormalizedMessageEvent[] {
    const events: NormalizedMessageEvent[] = [];

    // TikTok Business Messaging Webhook format (when granted developer scope)
    if (payload.event === "business.message" && payload.data) {
      const d = payload.data;
      const senderOpenId = d.sender_open_id || "guest_tt";

      events.push({
        platform: "TIKTOK",
        externalAccountId: d.business_id || "tt_biz_default",
        externalThreadId: getCanonicalExternalThreadId("TIKTOK", senderOpenId),
        externalMessageId: d.message_id || `tt_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        senderExternalId: senderOpenId,
        senderName: d.sender_name || `TikTok User (${senderOpenId.substring(0, 6)})`,
        senderHandle: d.sender_handle,
        direction: "INBOUND",
        messageType: "TEXT",
        textContent: d.text || "[TikTok message]",
        rawPayload: payload,
        timestamp: d.create_time ? new Date(d.create_time * 1000) : new Date(),
      });
    }

    return events;
  }
}
