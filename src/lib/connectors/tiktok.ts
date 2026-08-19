import { NormalizedMessageEvent, PlatformCapabilities } from "./types";

export class TikTokConnector {
  public static readonly capabilities: PlatformCapabilities = {
    messaging: false,
    webhooks: true,
    signatureVerification: true,
    rateLimitPerMinute: 60,
    requiresAppReview: true,
    productionReady: false,
    statusNotes: "RESTRICTED / REQUIRES ENTERPRISE APPROVAL: TikTok Business Messaging API requires approved Enterprise TikTok for Business verification and developer whitelisting for direct messages.",
  };

  public static parseWebhookPayload(payload: any): NormalizedMessageEvent[] {
    const events: NormalizedMessageEvent[] = [];

    // TikTok Business Messaging Webhook format (when granted developer scope)
    if (payload.event === "business.message" && payload.data) {
      const d = payload.data;
      events.push({
        platform: "TIKTOK",
        externalAccountId: d.business_id || "tt_biz_default",
        externalThreadId: `tt_thread_${d.sender_open_id}`,
        externalMessageId: d.message_id || `tt_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        senderExternalId: d.sender_open_id,
        senderName: d.sender_name || `TikTok User (${d.sender_open_id?.substring(0, 6) || "Guest"})`,
        senderHandle: d.sender_handle,
        direction: "INBOUND",
        textContent: d.text || "[TikTok message]",
        rawPayload: payload,
        timestamp: d.create_time ? new Date(d.create_time * 1000) : new Date(),
      });
    }

    return events;
  }
}
