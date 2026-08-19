import { NormalizedMessageEvent, PlatformCapabilities } from "./types";

export class WhatsAppConnector {
  public static readonly capabilities: PlatformCapabilities = {
    messaging: true,
    webhooks: true,
    signatureVerification: true,
    rateLimitPerMinute: 80,
    requiresAppReview: false, // Cloud API sandbox is self-serve; Meta Business Portfolio needed for production tier
    productionReady: true,
    statusNotes: "Officially supported via Meta WhatsApp Business Cloud API.",
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
              const senderName = contactMap[fromNumber] || `WhatsApp (+${fromNumber})`;
              const messageId = msg.id || `wa_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
              const time = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date();

              let textContent = "";
              let mediaUrl: string | undefined;
              let mediaType: any = undefined;

              if (msg.type === "text" && msg.text?.body) {
                textContent = msg.text.body;
              } else if (msg.type === "image") {
                mediaType = "IMAGE";
                mediaUrl = msg.image?.id || msg.image?.url;
                textContent = msg.image?.caption || "[Image Attachment]";
              } else if (msg.type === "document") {
                mediaType = "DOCUMENT";
                textContent = msg.document?.caption || `[Document: ${msg.document?.filename || "file"}]`;
              } else {
                textContent = `[${msg.type || "unknown"} message]`;
              }

              events.push({
                platform: "WHATSAPP",
                externalAccountId: wabaId,
                externalThreadId: `wa_thread_${fromNumber}`,
                externalMessageId: messageId,
                senderExternalId: fromNumber,
                senderName: senderName,
                senderPhone: `+${fromNumber}`,
                direction: "INBOUND",
                textContent,
                mediaUrl,
                mediaType,
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
}
