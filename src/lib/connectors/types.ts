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

export interface NormalizedMessageEvent {
  businessId?: string;
  environment?: "LIVE" | "PRACTICE";
  sourceType?: "FACEBOOK" | "INSTAGRAM" | "WHATSAPP" | "TIKTOK" | "SIMULATOR" | "MANUAL";
  platform: SupportedPlatform;
  externalAccountId: string; // Page ID, IG ID, WABA ID, TikTok Open ID
  externalThreadId?: string;
  externalMessageId: string;
  senderExternalId: string;
  senderName: string;
  senderHandle?: string;
  senderPhone?: string;
  senderEmail?: string;
  direction: MessageDirection;
  textContent: string;
  mediaUrl?: string;
  mediaType?: MediaType;
  rawPayload?: Record<string, any>;
  timestamp: Date;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  challenge?: string;
  error?: string;
}

export interface PlatformCapabilities {
  messaging: boolean;
  webhooks: boolean;
  signatureVerification: boolean;
  rateLimitPerMinute: number;
  requiresAppReview: boolean;
  productionReady: boolean;
  statusNotes: string;
}

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
  | "UNKNOWN_FACEBOOK_ERROR";

export interface NormalizedPlatformError {
  platform: SupportedPlatform;
  code: PlatformErrorCode;
  providerCode?: number;
  message: string;
  endpoint: string;
  operation: string;
  retryable: boolean;
}
