import { NormalizedMessageEvent, SupportedPlatform } from "./types";

export interface SimulationPreset {
  id: string;
  title: string;
  platform: SupportedPlatform;
  customerName: string;
  customerHandle?: string;
  customerPhone?: string;
  messageText: string;
  category: "PRODUCT_INQUIRY" | "PRICE_INQUIRY" | "PAYMENT_PROOF" | "AVAILABILITY_INQUIRY" | "GENERAL_QUESTION";
}

export const SIMULATION_PRESETS: SimulationPreset[] = [
  {
    id: "sim-t480-inquiry",
    title: "Lenovo T480 Availability & Discount Check",
    platform: "FACEBOOK",
    customerName: "Eduardo Mendoza",
    customerHandle: "eduardo.mendoza.dev",
    messageText: "Hello po! Available pa po ba yung Lenovo ThinkPad T480 Core i5? Magkano po pag cash discount?",
    category: "PRODUCT_INQUIRY",
  },
  {
    id: "sim-anker-gcash",
    title: "GCash Payment Proof Submission (₱1,890)",
    platform: "WHATSAPP",
    customerName: "Clarissa Tan",
    customerPhone: "+63 919 444 8899",
    messageText: "Good pm, paid na po ako sa GCash for Anker 65W GaN Charger ₱1,890. Ref: 204918273645. Padala na lang po sa Quezon City address ko.",
    category: "PAYMENT_PROOF",
  },
  {
    id: "sim-aspire5-stock",
    title: "Acer Aspire 5 Stock & Installment Check",
    platform: "INSTAGRAM",
    customerName: "Kenneth Dizon",
    customerHandle: "@kenneth_d",
    messageText: "Hi BizPilot! May stock pa po ba ng Acer Aspire 5 Ryzen 5? Pwede po ba SpayLater / Maya installment?",
    category: "PRICE_INQUIRY",
  },
  {
    id: "sim-logitech-intent",
    title: "Logitech MX Master 3S Urgent Purchase Intent",
    platform: "FACEBOOK",
    customerName: "Grace Villanueva",
    customerHandle: "grace.v",
    messageText: "Gusto ko po kunin yung Logitech MX Master 3S mouse. Pa-reserve po ng 1 unit, kunin ko via Grab Express within 1 hour.",
    category: "AVAILABILITY_INQUIRY",
  },
  {
    id: "sim-tiktok-keyboard",
    title: "Keychron K2 Sound Test & Stock Inquiry",
    platform: "TIKTOK",
    customerName: "Raffy Santos",
    customerHandle: "@raffy_keebs",
    messageText: "Saw your TikTok video! Available pa ba Keychron K2 Gateron Brown? Magkano kasama shipping?",
    category: "PRODUCT_INQUIRY",
  },
];

export class DeveloperSimulator {
  public static createSimulatedEvent(
    platform: SupportedPlatform,
    senderName: string,
    messageText: string,
    options?: {
      senderExternalId?: string;
      senderHandle?: string;
      senderPhone?: string;
      externalAccountId?: string;
      businessId?: string;
    }
  ): NormalizedMessageEvent {
    const senderExternalId = options?.senderExternalId || `sim_${platform.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const messageId = `sim_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return {
      businessId: options?.businessId,
      platform,
      externalAccountId: options?.externalAccountId || `sim_account_${platform.toLowerCase()}`,
      externalThreadId: `sim_thread_${senderExternalId}`,
      externalMessageId: messageId,
      senderExternalId,
      senderName,
      senderHandle: options?.senderHandle,
      senderPhone: options?.senderPhone,
      direction: "INBOUND",
      textContent: messageText,
      timestamp: new Date(),
      rawPayload: {
        actorType: "CUSTOMER",
        senderRole: "CUSTOMER",
        isPractice: true,
        dispatchStatus: "SIMULATED_RECEIVED",
      },
    };
  }
}
