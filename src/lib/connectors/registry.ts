/**
 * BizPilot Universal Social Platform Registry
 * 
 * Centralized registry for all social and messaging platform connectors.
 * Defines capabilities, required OAuth scopes, minimum subscription tiers,
 * approval requirements, and connection lifecycle metadata.
 */

import { PlanTier } from "../plans";
import { FacebookMessengerConnector } from "./facebook";
import { InstagramConnector } from "./instagram";
import { WhatsAppConnector } from "./whatsapp";
import { TikTokConnector } from "./tiktok";
import { GranularPlatformCapabilities } from "./types";

export type PlatformId =
  | "FACEBOOK"
  | "INSTAGRAM"
  | "WHATSAPP"
  | "TIKTOK"
  | "TELEGRAM"
  | "VIBER"
  | "SHOPEE"
  | "LAZADA";

export type ConnectionStatus =
  | "PENDING"
  | "CONNECTED"
  | "NEEDS_REAUTH"
  | "DISCONNECTED"
  | "SUSPENDED_BY_PLAN"
  | "AUTH_FAILED"
  | "REVOKED";

export interface PlatformMetadata {
  id: PlatformId;
  name: string;
  category: "SOCIAL_MESSAGING" | "MARKETPLACE";
  officialProduct: string;
  description: string;
  minPlanTier: PlanTier;
  multiAccountSupported: boolean;
  approvalRequired: boolean;
  approvalStatus: "AVAILABLE" | "PENDING_ENTERPRISE_REVIEW" | "UPCOMING";
  capabilities: GranularPlatformCapabilities;
  requiredPermissions: string[];
  privacyNotes: string;
}

export const PLATFORM_REGISTRY: Record<PlatformId, PlatformMetadata> = {
  FACEBOOK: {
    id: "FACEBOOK",
    name: "Facebook Messenger",
    category: "SOCIAL_MESSAGING",
    officialProduct: "Meta Messenger Platform (Graph API)",
    description: "Connect Facebook Business Pages to receive and reply to customer inquiries.",
    minPlanTier: "STARTER",
    multiAccountSupported: true,
    approvalRequired: false,
    approvalStatus: "AVAILABLE",
    capabilities: FacebookMessengerConnector.capabilities,
    requiredPermissions: ["pages_messaging", "pages_show_list", "pages_read_engagement"],
    privacyNotes: "Only authorized messages sent directly to connected Business Pages are ingested. Unrelated personal messages are never accessed.",
  },
  INSTAGRAM: {
    id: "INSTAGRAM",
    name: "Instagram Direct",
    category: "SOCIAL_MESSAGING",
    officialProduct: "Instagram Messaging API",
    description: "Receive Direct Messages and story inquiries from Instagram Professional accounts.",
    minPlanTier: "BUSINESS",
    multiAccountSupported: true,
    approvalRequired: false,
    approvalStatus: "AVAILABLE",
    capabilities: InstagramConnector.capabilities,
    requiredPermissions: ["instagram_manage_messages", "pages_manage_metadata"],
    privacyNotes: "Only DMs sent to connected Professional accounts are ingested. Personal Instagram accounts are not monitored.",
  },
  WHATSAPP: {
    id: "WHATSAPP",
    name: "WhatsApp Business",
    category: "SOCIAL_MESSAGING",
    officialProduct: "WhatsApp Business Cloud API",
    description: "Direct customer messaging via official Meta WhatsApp Business numbers.",
    minPlanTier: "BUSINESS",
    multiAccountSupported: true,
    approvalRequired: false,
    approvalStatus: "AVAILABLE",
    capabilities: WhatsAppConnector.capabilities,
    requiredPermissions: ["whatsapp_business_messaging", "whatsapp_business_management"],
    privacyNotes: "Only conversations directed to the verified WhatsApp Business Account (WABA) are ingested.",
  },
  TIKTOK: {
    id: "TIKTOK",
    name: "TikTok Messaging",
    category: "SOCIAL_MESSAGING",
    officialProduct: "TikTok Business Messaging API",
    description: "Receive customer messages from TikTok Business Accounts.",
    minPlanTier: "PRO",
    multiAccountSupported: true,
    approvalRequired: true,
    approvalStatus: "PENDING_ENTERPRISE_REVIEW",
    capabilities: TikTokConnector.capabilities,
    requiredPermissions: ["business.message.read", "business.message.write"],
    privacyNotes: "TikTok Business Messaging requires enterprise partner verification by ByteDance. Personal accounts cannot be connected.",
  },
  TELEGRAM: {
    id: "TELEGRAM",
    name: "Telegram Bot API",
    category: "SOCIAL_MESSAGING",
    officialProduct: "Telegram Bot Platform",
    description: "Connect Telegram official business bot accounts.",
    minPlanTier: "PRO",
    multiAccountSupported: true,
    approvalRequired: false,
    approvalStatus: "UPCOMING",
    capabilities: {
      messaging: true,
      webhooks: true,
      signatureVerification: true,
      rateLimitPerMinute: 120,
      requiresAppReview: false,
      productionReady: false,
      statusNotes: "Upcoming integration via Telegram Bot API.",
      inbound: { text: true, image: true, video: true, audio: true, document: true, sticker: true, location: true },
      outbound: { text: true, image: true, video: true, audio: true, document: true },
      reconciliation: false,
      reconciliationNotes: "Webhook-based Bot API updates.",
    },
    requiredPermissions: ["bot_api_token"],
    privacyNotes: "Only conversations routed to the registered Bot are processed.",
  },
  VIBER: {
    id: "VIBER",
    name: "Viber Business Messages",
    category: "SOCIAL_MESSAGING",
    officialProduct: "Viber Business Messaging",
    description: "Enterprise messaging via Viber Business Bot account.",
    minPlanTier: "PRO",
    multiAccountSupported: true,
    approvalRequired: true,
    approvalStatus: "UPCOMING",
    capabilities: {
      messaging: true,
      webhooks: true,
      signatureVerification: true,
      rateLimitPerMinute: 60,
      requiresAppReview: true,
      productionReady: false,
      statusNotes: "Upcoming integration via Viber Commercial Messages.",
      inbound: { text: true, image: true, video: true, audio: false, document: true, sticker: false, location: false },
      outbound: { text: true, image: true, video: false, audio: false, document: false },
      reconciliation: false,
      reconciliationNotes: "Webhook-based message delivery.",
    },
    requiredPermissions: ["viber_bot_auth"],
    privacyNotes: "Viber commercial messaging account required.",
  },
  SHOPEE: {
    id: "SHOPEE",
    name: "Shopee Open Platform",
    category: "MARKETPLACE",
    officialProduct: "Shopee Open Platform API",
    description: "Synchronize Shopee marketplace store orders and chats.",
    minPlanTier: "PRO",
    multiAccountSupported: true,
    approvalRequired: true,
    approvalStatus: "UPCOMING",
    capabilities: {
      messaging: true,
      webhooks: true,
      signatureVerification: true,
      rateLimitPerMinute: 60,
      requiresAppReview: true,
      productionReady: false,
      statusNotes: "Upcoming integration via Shopee Open Platform.",
      inbound: { text: true, image: true, video: false, audio: false, document: false, sticker: false, location: false },
      outbound: { text: true, image: true, video: false, audio: false, document: false },
      reconciliation: true,
      reconciliationNotes: "Periodic chat pull sync via Open Platform token.",
    },
    requiredPermissions: ["shopee_seller_auth"],
    privacyNotes: "Store-level marketplace token required.",
  },
  LAZADA: {
    id: "LAZADA",
    name: "Lazada Open Platform",
    category: "MARKETPLACE",
    officialProduct: "Lazada Open Platform API",
    description: "Synchronize Lazada marketplace store orders and chats.",
    minPlanTier: "PRO",
    multiAccountSupported: true,
    approvalRequired: true,
    approvalStatus: "UPCOMING",
    capabilities: {
      messaging: true,
      webhooks: true,
      signatureVerification: true,
      rateLimitPerMinute: 60,
      requiresAppReview: true,
      productionReady: false,
      statusNotes: "Upcoming integration via Lazada Open Platform.",
      inbound: { text: true, image: true, video: false, audio: false, document: false, sticker: false, location: false },
      outbound: { text: true, image: true, video: false, audio: false, document: false },
      reconciliation: true,
      reconciliationNotes: "Periodic chat pull sync via Open Platform token.",
    },
    requiredPermissions: ["lazada_seller_auth"],
    privacyNotes: "Seller authorization required.",
  },
};

/**
 * Get metadata for a platform
 */
export function getPlatformMetadata(platform: string): PlatformMetadata | null {
  const key = platform.toUpperCase() as PlatformId;
  return PLATFORM_REGISTRY[key] || null;
}

/**
 * Get granular capabilities for a platform
 */
export function getPlatformCapabilities(platform: string): GranularPlatformCapabilities {
  const meta = getPlatformMetadata(platform);
  if (meta?.capabilities) {
    return meta.capabilities;
  }
  // Safe default fallback for unknown/manual platforms
  return {
    messaging: true,
    webhooks: false,
    signatureVerification: false,
    rateLimitPerMinute: 60,
    requiresAppReview: false,
    productionReady: false,
    statusNotes: "Custom / Manual Platform",
    inbound: { text: true, image: false, video: false, audio: false, document: false, sticker: false, location: false },
    outbound: { text: true, image: false, video: false, audio: false, document: false },
    reconciliation: false,
    reconciliationNotes: "Manual entry only.",
  };
}

/**
 * Get all supported platforms
 */
export function getAllPlatforms(): PlatformMetadata[] {
  return Object.values(PLATFORM_REGISTRY);
}
