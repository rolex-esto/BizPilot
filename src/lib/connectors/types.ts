export type SupportedPlatform = "FACEBOOK" | "INSTAGRAM" | "WHATSAPP" | "TIKTOK";

export type ConnectionStatus =
  | "PENDING_VALIDATION"
  | "CONNECTED"
  | "NEEDS_REAUTH"
  | "ACCOUNT_MISMATCH"
  | "MISSING_PERMISSION"
  | "DISCONNECTED"
  | "ERROR"
  | "PENDING_APPROVAL";

export type MessageDirection = "INBOUND" | "OUTBOUND";

export type MediaType = "IMAGE" | "AUDIO" | "DOCUMENT" | "VIDEO";

export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "DOCUMENT"
  | "STICKER"
  | "LOCATION"
  | "SYSTEM"
  | "UNKNOWN";

export interface MediaMetadata {
  url?: string;
  mediaId?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  filename?: string;
  thumbnailUrl?: string;
  sha256?: string;
  animated?: boolean;
}

export interface LocationMetadata {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  url?: string;
}

export interface NormalizedMessageEvent {
  businessId?: string;
  environment?: "LIVE" | "PRACTICE";
  sourceType?: "FACEBOOK" | "INSTAGRAM" | "WHATSAPP" | "TIKTOK" | "SIMULATOR" | "MANUAL";
  platform: SupportedPlatform;
  externalAccountId: string; // Page ID, IG ID, WABA ID, TikTok Open ID
  externalThreadId?: string;
  externalMessageId: string;
  senderExternalId: string;
  senderName?: string;
  senderHandle?: string;
  senderPhone?: string;
  senderEmail?: string;
  direction: MessageDirection;
  messageType?: MessageType;
  textContent: string;
  mediaUrl?: string;
  mediaType?: MediaType;
  mediaMetadata?: MediaMetadata;
  locationMetadata?: LocationMetadata;
  rawPayload?: Record<string, any>;
  timestamp: Date;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  challenge?: string;
  error?: string;
}

export interface GranularPlatformCapabilities {
  messaging: boolean;
  webhooks: boolean;
  signatureVerification: boolean;
  rateLimitPerMinute: number;
  requiresAppReview: boolean;
  productionReady: boolean;
  statusNotes: string;
  inbound: {
    text: boolean;
    image: boolean;
    video: boolean;
    audio: boolean;
    document: boolean;
    sticker: boolean;
    location: boolean;
  };
  outbound: {
    text: boolean;
    image: boolean;
    video: boolean;
    audio: boolean;
    document: boolean;
  };
  reconciliation: boolean;
  reconciliationNotes: string;
}

export type PlatformCapabilities = GranularPlatformCapabilities;

export type PlatformErrorCode =
  | "INVALID_PAGE"
  | "MISSING_PERMISSION"
  | "INVALID_ACCESS_TOKEN"
  | "EXPIRED_ACCESS_TOKEN"
  | "PAGE_NOT_ACCESSIBLE"
  | "APP_REVIEW_REQUIRED"
  | "FEATURE_NOT_ENABLED"
  | "FACEBOOK_ACCOUNT_MISMATCH"
  | "PAGE_ID_NOT_FOUND"
  | "GRAPH_API_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN_FACEBOOK_ERROR"
  | "UNSUPPORTED_OPERATION";

export interface NormalizedPlatformError {
  platform: SupportedPlatform;
  code: PlatformErrorCode;
  providerCode?: number;
  message: string;
  endpoint: string;
  operation: string;
  retryable: boolean;
}

/**
 * CANONICAL EXTERNAL THREAD ID RESOLUTION
 * Guarantees webhook and reconciliation always produce the exact same thread ID
 * across all connectors and synchronization pipelines.
 */
export function getCanonicalExternalThreadId(
  platform: SupportedPlatform | string,
  customerIdentifier: string
): string {
  const cleanId = (customerIdentifier || "").trim();
  const upperPlatform = (platform || "").toUpperCase();

  switch (upperPlatform) {
    case "FACEBOOK":
      return `fb_thread_${cleanId}`;
    case "INSTAGRAM":
      return `ig_thread_${cleanId}`;
    case "WHATSAPP":
      // Strip leading plus or spaces for canonical consistency
      return `wa_thread_${cleanId.replace(/^\+/, "").replace(/\s+/g, "")}`;
    case "TIKTOK":
      return `tt_thread_${cleanId}`;
    default:
      return `${upperPlatform.toLowerCase()}_thread_${cleanId}`;
  }
}
