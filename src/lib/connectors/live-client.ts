/**
 * BizPilot Versioned Real Platform API Client
 * 
 * Standardized communication client for Meta Graph API (Facebook Messenger & Instagram Direct),
 * WhatsApp Business Cloud API, and ByteDance TikTok Messaging API.
 * 
 * Never exposes raw tokens in logs or returned error responses.
 */

import { SupportedPlatform } from "./types";

export type HealthStatusCategory =
  | "REAL_API_PASS"
  | "REAL_API_FAIL"
  | "SIMULATOR_ONLY"
  | "MISSING_CREDENTIALS"
  | "MISSING_PERMISSION"
  | "TOKEN_EXPIRED"
  | "TOKEN_REVOKED"
  | "INVALID_TOKEN"
  | "RATE_LIMITED"
  | "API_UNAVAILABLE"
  | "BLOCKED"
  | "NETWORK_ERROR";

export interface LiveApiResult {
  success: boolean;
  platform: SupportedPlatform;
  operation: "TOKEN_VERIFY" | "ACCOUNT_DISCOVERY" | "SEND_MESSAGE" | "READ_METRICS";
  httpStatus?: number;
  platformObjectId?: string;
  latencyMs: number;
  statusCategory: HealthStatusCategory;
  errorMessage?: string;
  tokenHealth?: {
    isValid: boolean;
    expiresAt?: Date | null;
    scopesGranted?: string[];
    accountName?: string;
    accountId?: string;
  };
  normalizedError?: import("./types").NormalizedPlatformError;
}

export interface ApiClientConfig {
  graphApiVersion: string;
  metaBaseUrl: string;
  tiktokApiVersion: string;
  tiktokBaseUrl: string;
  timeoutMs: number;
  fetchFn?: typeof fetch;
}

export const DEFAULT_API_CONFIG: ApiClientConfig = {
  graphApiVersion: process.env.META_GRAPH_API_VERSION || "v19.0",
  metaBaseUrl: process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com",
  tiktokApiVersion: process.env.TIKTOK_API_VERSION || "v2",
  tiktokBaseUrl: process.env.TIKTOK_BASE_URL || "https://open.tiktokapis.com",
  timeoutMs: 8000,
};

export class LivePlatformApiClient {
  private config: ApiClientConfig;

  constructor(config?: Partial<ApiClientConfig>) {
    this.config = { ...DEFAULT_API_CONFIG, ...config };
  }

  /**
   * Tests token health and account validity against the live platform API.
   */
  public async verifyTokenHealth(
    platform: SupportedPlatform,
    rawToken: string | null | undefined,
    platformAccountId?: string
  ): Promise<LiveApiResult> {
    const startTime = Date.now();

    if (!rawToken || rawToken.trim() === "" || rawToken === "none") {
      return {
        success: false,
        platform,
        operation: "TOKEN_VERIFY",
        latencyMs: Date.now() - startTime,
        statusCategory: "MISSING_CREDENTIALS",
        errorMessage: "No access token is configured.",
      };
    }

    if (rawToken.startsWith("sim_")) {
      return {
        success: true,
        platform,
        operation: "TOKEN_VERIFY",
        latencyMs: Date.now() - startTime,
        statusCategory: "SIMULATOR_ONLY",
        errorMessage: "Channel operates in Developer Simulator mode.",
        tokenHealth: {
          isValid: true,
          accountId: platformAccountId || `sim_${platform.toLowerCase()}`,
          accountName: "Developer Simulator",
        },
      };
    }

    if (platform === "TIKTOK") {
      return {
        success: false,
        platform,
        operation: "TOKEN_VERIFY",
        latencyMs: Date.now() - startTime,
        statusCategory: "BLOCKED",
        errorMessage: "TikTok Business Messaging API requires approved Enterprise TikTok for Business verification and developer whitelisting.",
      };
    }

    try {
      const fetchToUse = this.config.fetchFn || globalThis.fetch;
      const redacted = rawToken.length > 8 ? `${rawToken.substring(0, 4)}...${rawToken.substring(rawToken.length - 4)}` : "***";

      // 1. Authoritative Token Self-Inspection via /debug_token
      // Meta Graph API allows any token to inspect itself without requiring pages_read_engagement
      const debugEndpoint = `${this.config.metaBaseUrl}/${this.config.graphApiVersion}/debug_token?input_token=${encodeURIComponent(rawToken)}&access_token=${encodeURIComponent(rawToken)}`;
      console.log(`[${platform}][TRACE] REQUEST operation=DEBUG_TOKEN method=GET path=/debug_token token=${redacted}`);

      const debugRes = await fetchToUse(debugEndpoint, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "BizPilot-Connector-Verifier/1.0",
        },
      });

      const debugData = await debugRes.json().catch(() => ({}));
      const debugInfo = debugData.data;

      if (debugRes.ok && debugInfo?.is_valid) {
        const resolvedPageId = debugInfo.profile_id || debugInfo.user_id || platformAccountId;
        const scopes = debugInfo.scopes || [];
        console.log(`[${platform}][TRACE] RESPONSE operation=DEBUG_TOKEN status=${debugRes.status} success=true profile_id=${resolvedPageId} type=${debugInfo.type} scopes=${JSON.stringify(scopes)}`);

        // Automatically activate Messenger webhook subscription
        try {
          console.log(`[${platform}][TRACE] REQUEST operation=SUBSCRIBE_WEBHOOK method=POST path=/me/subscribed_apps`);
          const subPostRes = await fetchToUse(`${this.config.metaBaseUrl}/${this.config.graphApiVersion}/me/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${encodeURIComponent(rawToken)}`, {
            method: "POST",
            headers: { "Accept": "application/json" },
          });
          console.log(`[${platform}][TRACE] RESPONSE operation=SUBSCRIBE_WEBHOOK status=${subPostRes.status} success=${subPostRes.ok}`);
        } catch (subErr: any) {
          console.log(`[${platform}][TRACE] RESPONSE operation=SUBSCRIBE_WEBHOOK status=FAILED reason=${subErr.message}`);
        }

        return {
          success: true,
          platform,
          operation: "TOKEN_VERIFY",
          httpStatus: debugRes.status,
          platformObjectId: resolvedPageId,
          latencyMs: Date.now() - startTime,
          statusCategory: "REAL_API_PASS",
          tokenHealth: {
            isValid: true,
            accountId: resolvedPageId,
            accountName: "BizPilot",
            scopesGranted: scopes,
          },
        };
      } else {
        console.log(`[${platform}][TRACE] RESPONSE operation=DEBUG_TOKEN status=${debugRes.status} success=false code=${debugData?.error?.code || "INVALID"}`);
      }

      let lastErrorObj: any = debugData?.error || {};
      let lastHttpStatus: number | undefined = debugRes?.status;

      // 2. Official Messenger Subscribed Apps Handshake (/me/subscribed_apps)
      // This is the standard Messenger Platform endpoint requiring ONLY pages_messaging
      if (platform === "FACEBOOK" || platform === "INSTAGRAM") {
        const subscribedEndpoint = `${this.config.metaBaseUrl}/${this.config.graphApiVersion}/me/subscribed_apps?access_token=${encodeURIComponent(rawToken)}`;
        console.log(`[${platform}][TRACE] REQUEST operation=SUBSCRIBED_APPS method=GET path=/me/subscribed_apps token=${redacted}`);

        const subRes = await fetchToUse(subscribedEndpoint, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "User-Agent": "BizPilot-Connector-Verifier/1.0",
          },
        });

        const subData = await subRes.json().catch(() => ({}));
        console.log(`[${platform}][TRACE] RESPONSE operation=SUBSCRIBED_APPS status=${subRes.status} success=${subRes.ok} data=${JSON.stringify(subData)}`);

        if (subRes.ok) {
          const resolvedPageId = subData?.id || (Array.isArray(subData?.data) && subData?.data[0]?.id) || platformAccountId;

          // Automatically ensure webhook subscription is active
          try {
            console.log(`[${platform}][TRACE] REQUEST operation=SUBSCRIBE_WEBHOOK method=POST path=/me/subscribed_apps`);
            const subPostRes = await fetchToUse(`${this.config.metaBaseUrl}/${this.config.graphApiVersion}/me/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${encodeURIComponent(rawToken)}`, {
              method: "POST",
              headers: { "Accept": "application/json" },
            });
            console.log(`[${platform}][TRACE] RESPONSE operation=SUBSCRIBE_WEBHOOK status=${subPostRes.status} success=${subPostRes.ok}`);
          } catch (subErr: any) {
            console.log(`[${platform}][TRACE] RESPONSE operation=SUBSCRIBE_WEBHOOK status=FAILED reason=${subErr.message}`);
          }

          return {
            success: true,
            platform,
            operation: "TOKEN_VERIFY",
            httpStatus: subRes.status,
            platformObjectId: resolvedPageId,
            latencyMs: Date.now() - startTime,
            statusCategory: "REAL_API_PASS",
            tokenHealth: {
              isValid: true,
              accountId: resolvedPageId,
              accountName: "BizPilot",
              scopesGranted: ["pages_messaging"],
            },
          };
        } else if (subData?.error) {
          lastErrorObj = subData.error;
          lastHttpStatus = subRes.status;
        }
      }

      // 3. WhatsApp WABA Health Check
      if (platform === "WHATSAPP") {
        const isNumericWaba = platformAccountId && /^\d+$/.test(platformAccountId);
        const wabaId = isNumericWaba ? platformAccountId : "me";
        const wabaEndpoint = `${this.config.metaBaseUrl}/${this.config.graphApiVersion}/${wabaId}?fields=id,name&access_token=${encodeURIComponent(rawToken)}`;
        console.log(`[${platform}][TRACE] REQUEST operation=WABA_LOOKUP method=GET path=/${wabaId} token=${redacted}`);

        const wabaRes = await fetchToUse(wabaEndpoint, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "User-Agent": "BizPilot-Connector-Verifier/1.0",
          },
        });
        const wabaData = await wabaRes.json().catch(() => ({}));
        if (wabaRes.ok && wabaData.id) {
          return {
            success: true,
            platform,
            operation: "TOKEN_VERIFY",
            httpStatus: wabaRes.status,
            platformObjectId: wabaData.id,
            latencyMs: Date.now() - startTime,
            statusCategory: "REAL_API_PASS",
            tokenHealth: {
              isValid: true,
              accountId: wabaData.id,
              accountName: wabaData.name || platformAccountId,
            },
          };
        } else if (wabaData?.error) {
          lastErrorObj = wabaData.error;
          lastHttpStatus = wabaRes.status;
        }
      }

      let statusCategory: HealthStatusCategory = "REAL_API_FAIL";
      let normalizedCode: import("./types").PlatformErrorCode = "GRAPH_API_ERROR";
      const errorObj = lastErrorObj || {};
      const errorCode = errorObj.code;
      const errorSubcode = errorObj.error_subcode;
      const errorMsg = errorObj.message || "";

      if (
        errorCode === 190 ||
        errorMsg.toLowerCase().includes("oauth") ||
        errorMsg.toLowerCase().includes("access token")
      ) {
        if (errorSubcode === 460 || errorSubcode === 463 || errorSubcode === 467 || errorMsg.toLowerCase().includes("expired")) {
          statusCategory = "TOKEN_EXPIRED";
          normalizedCode = "EXPIRED_ACCESS_TOKEN";
        } else if (errorSubcode === 458 || errorSubcode === 490 || errorMsg.toLowerCase().includes("revoked")) {
          statusCategory = "TOKEN_REVOKED";
          normalizedCode = "INVALID_ACCESS_TOKEN";
        } else {
          statusCategory = "INVALID_TOKEN";
          normalizedCode = "INVALID_ACCESS_TOKEN";
        }
      } else if (errorCode === 10 || errorCode === 200 || errorCode === 298 || (errorCode === 100 && (errorMsg.includes("permission") || errorMsg.includes("feature")))) {
        statusCategory = "MISSING_PERMISSION";
        normalizedCode = errorMsg.includes("feature") || errorMsg.includes("review") ? "APP_REVIEW_REQUIRED" : "MISSING_PERMISSION";
      } else if (errorCode === 100 && errorMsg.includes("does not exist")) {
        statusCategory = "INVALID_TOKEN";
        normalizedCode = "PAGE_NOT_ACCESSIBLE";
      } else if (errorCode === 4 || errorCode === 17 || errorCode === 32 || lastHttpStatus === 429) {
        statusCategory = "RATE_LIMITED";
        normalizedCode = "GRAPH_API_ERROR";
      } else if (lastHttpStatus && lastHttpStatus >= 500) {
        statusCategory = "API_UNAVAILABLE";
        normalizedCode = "NETWORK_ERROR";
      }

      console.log(`[${platform}] Graph API error provider_code=${errorCode || lastHttpStatus} operation=TOKEN_VERIFY reason=${normalizedCode}`);

      const latencyMs = Date.now() - startTime;

      return {
        success: false,
        platform,
        operation: "TOKEN_VERIFY",
        httpStatus: lastHttpStatus,
        latencyMs,
        statusCategory,
        errorMessage: errorObj.message || `Platform API returned HTTP ${lastHttpStatus}`,
        normalizedError: {
          platform,
          code: normalizedCode,
          providerCode: errorCode,
          message: errorObj.message || `Platform API returned HTTP ${lastHttpStatus}`,
          endpoint: `${this.config.metaBaseUrl}/${this.config.graphApiVersion}/debug_token`,
          operation: "TOKEN_VERIFY",
          retryable: statusCategory === "RATE_LIMITED" || statusCategory === "API_UNAVAILABLE",
        },
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const isTimeout = err.name === "AbortError";

      console.log(`[${platform}] Network error operation=TOKEN_VERIFY reason=${isTimeout ? "TIMEOUT" : "FETCH_ERROR"}`);

      return {
        success: false,
        platform,
        operation: "TOKEN_VERIFY",
        latencyMs,
        statusCategory: isTimeout ? "API_UNAVAILABLE" : "REAL_API_FAIL",
        errorMessage: isTimeout ? "Connection timed out connecting to platform API." : (err.message || "Network error"),
        normalizedError: {
          platform,
          code: isTimeout ? "NETWORK_ERROR" : "GRAPH_API_ERROR",
          message: isTimeout ? "Connection timed out connecting to platform API." : (err.message || "Network error"),
          endpoint: `${this.config.metaBaseUrl}/${this.config.graphApiVersion}/debug_token`,
          operation: "TOKEN_VERIFY",
          retryable: true,
        },
      };
    }
  }

  /**
   * Dispatches an outbound message to the official platform API.
   */
  public async sendOutboundMessage(
    platform: SupportedPlatform,
    rawToken: string | null | undefined,
    platformAccountId: string,
    recipientExternalId: string,
    textContent: string
  ): Promise<LiveApiResult> {
    const startTime = Date.now();

    if (!rawToken || rawToken.trim() === "" || rawToken.startsWith("sim_") || rawToken === "none") {
      return {
        success: false,
        platform,
        operation: "SEND_MESSAGE",
        latencyMs: Date.now() - startTime,
        statusCategory: "SIMULATOR_ONLY",
        errorMessage: "No live OAuth token configured. Outbound message was stored in local CRM database.",
      };
    }

    if (platform === "TIKTOK") {
      return {
        success: false,
        platform,
        operation: "SEND_MESSAGE",
        latencyMs: Date.now() - startTime,
        statusCategory: "BLOCKED",
        errorMessage: "TikTok Direct Messaging API requires Enterprise App Review and Whitelisting.",
      };
    }

    try {
      let endpoint = "";
      let payload: any = {};

      if (platform === "FACEBOOK" || platform === "INSTAGRAM") {
        endpoint = `${this.config.metaBaseUrl}/${this.config.graphApiVersion}/me/messages?access_token=${encodeURIComponent(rawToken)}`;
        payload = {
          recipient: { id: recipientExternalId },
          messaging_type: "RESPONSE",
          message: { text: textContent },
        };
      } else if (platform === "WHATSAPP") {
        const phoneId = platformAccountId;
        endpoint = `${this.config.metaBaseUrl}/${this.config.graphApiVersion}/${phoneId}/messages`;
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipientExternalId.replace("+", "").trim(),
          type: "text",
          text: { body: textContent },
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json",
      };

      if (platform === "WHATSAPP") {
        headers["Authorization"] = `Bearer ${rawToken}`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers,
        body: JSON.stringify(payload),
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      const httpStatus = response.status;
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        const platformObjectId = data.message_id || data.messages?.[0]?.id || data.id || `meta_msg_${Date.now()}`;
        return {
          success: true,
          platform,
          operation: "SEND_MESSAGE",
          httpStatus,
          platformObjectId,
          latencyMs,
          statusCategory: "REAL_API_PASS",
        };
      }

      // Handle Meta Graph API Error
      const errorObj = data.error || {};
      const errorCode = errorObj.code;
      let statusCategory: HealthStatusCategory = "REAL_API_FAIL";

      if (errorCode === 190) {
        statusCategory = "TOKEN_EXPIRED";
      } else if (errorCode === 10 || errorCode === 200 || errorCode === 551) {
        statusCategory = "MISSING_PERMISSION";
      } else if (errorCode === 4 || errorCode === 17 || httpStatus === 429) {
        statusCategory = "RATE_LIMITED";
      } else if (httpStatus >= 500) {
        statusCategory = "API_UNAVAILABLE";
      }

      return {
        success: false,
        platform,
        operation: "SEND_MESSAGE",
        httpStatus,
        latencyMs,
        statusCategory,
        errorMessage: errorObj.message || `Failed to dispatch message via ${platform} API (HTTP ${httpStatus})`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const isTimeout = err.name === "AbortError";

      return {
        success: false,
        platform,
        operation: "SEND_MESSAGE",
        latencyMs,
        statusCategory: isTimeout ? "API_UNAVAILABLE" : "REAL_API_FAIL",
        errorMessage: isTimeout ? "API request timed out." : (err.message || "Network error"),
      };
    }
  }

  /**
   * Fetches customer public profile (name, first_name, last_name, avatar) from official platform Graph API.
   * Scoped strictly to the Page-Scoped ID (PSID) / IGSID within the connected business account context.
   */
  public async fetchUserProfile(
    platform: SupportedPlatform,
    rawToken: string | null | undefined,
    externalId: string
  ): Promise<UserProfileLookupResult> {
    if (!externalId || !rawToken || rawToken.startsWith("sim_") || rawToken === "none") {
      return {
        success: false,
        platform,
        platformUserId: externalId,
        source: "FALLBACK",
        isFallback: true,
      };
    }

    if (platform === "FACEBOOK") {
      try {
        const fetchToUse = this.config.fetchFn || globalThis.fetch;
        const endpoint = `${this.config.metaBaseUrl}/${this.config.graphApiVersion}/${encodeURIComponent(externalId)}?fields=name,first_name,last_name,profile_pic&access_token=${encodeURIComponent(rawToken)}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs || 5000);

        const res = await fetchToUse(endpoint, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "Accept": "application/json",
            "User-Agent": "BizPilot-Profile-Resolver/1.0",
          },
        });
        clearTimeout(timeoutId);

        const data = await res.json().catch(() => ({}));
        if (res.ok && data && (data.name || data.first_name)) {
          const fullName = data.name || [data.first_name, data.last_name].filter(Boolean).join(" ");
          return {
            success: true,
            platform: "FACEBOOK",
            platformUserId: externalId,
            name: fullName,
            firstName: data.first_name,
            lastName: data.last_name,
            avatarUrl: data.profile_pic,
            source: "GRAPH_API_USER_PROFILE",
            isFallback: false,
          };
        }

        return {
          success: false,
          platform: "FACEBOOK",
          platformUserId: externalId,
          source: "FALLBACK",
          isFallback: true,
          errorMessage: data?.error?.message || `HTTP ${res.status}`,
        };
      } catch (err: any) {
        return {
          success: false,
          platform: "FACEBOOK",
          platformUserId: externalId,
          source: "FALLBACK",
          isFallback: true,
          errorMessage: err.message,
        };
      }
    }

    if (platform === "INSTAGRAM") {
      try {
        const fetchToUse = this.config.fetchFn || globalThis.fetch;
        const endpoint = `${this.config.metaBaseUrl}/${this.config.graphApiVersion}/${encodeURIComponent(externalId)}?fields=name,username,profile_pic&access_token=${encodeURIComponent(rawToken)}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs || 5000);

        const res = await fetchToUse(endpoint, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "Accept": "application/json",
            "User-Agent": "BizPilot-Profile-Resolver/1.0",
          },
        });
        clearTimeout(timeoutId);

        const data = await res.json().catch(() => ({}));
        if (res.ok && data && (data.name || data.username)) {
          return {
            success: true,
            platform: "INSTAGRAM",
            platformUserId: externalId,
            name: data.name || data.username,
            handle: data.username ? `@${data.username}` : undefined,
            avatarUrl: data.profile_pic,
            source: "GRAPH_API_USER_PROFILE",
            isFallback: false,
          };
        }

        return {
          success: false,
          platform: "INSTAGRAM",
          platformUserId: externalId,
          source: "FALLBACK",
          isFallback: true,
          errorMessage: data?.error?.message || `HTTP ${res.status}`,
        };
      } catch (err: any) {
        return {
          success: false,
          platform: "INSTAGRAM",
          platformUserId: externalId,
          source: "FALLBACK",
          isFallback: true,
          errorMessage: err.message,
        };
      }
    }

    return {
      success: false,
      platform,
      platformUserId: externalId,
      source: "FALLBACK",
      isFallback: true,
    };
  }
}

export interface UserProfileLookupResult {
  success: boolean;
  platform: SupportedPlatform;
  platformUserId: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  handle?: string;
  avatarUrl?: string;
  source: "GRAPH_API_USER_PROFILE" | "WEBHOOK_PAYLOAD" | "FALLBACK";
  isFallback: boolean;
  errorMessage?: string;
}
