/**
 * BizPilot Social Customer Identity Resolver
 * 
 * Centralized identity resolution, profile verification, and fallback governance
 * across Facebook Messenger, Instagram Direct, WhatsApp Business, and TikTok.
 * 
 * Guarantees:
 * 1. Safe Graph API User Profile lookup within connected business context.
 * 2. Automatic upgrade of existing fallback identities when real profile data arrives.
 * 3. Never invents fake names; preserves truthful fallback labels when APIs restrict access.
 * 4. Multi-tenant and multi-page boundary isolation.
 */

import { SupportedPlatform, NormalizedMessageEvent } from "./types";
import { LivePlatformApiClient, UserProfileLookupResult } from "./live-client";

export interface ResolvedCustomerIdentity {
  name: string;
  handle?: string;
  avatarUrl?: string;
  phone?: string;
  email?: string;
  isFallback: boolean;
  source: "GRAPH_API" | "WEBHOOK_PAYLOAD" | "SIMULATOR" | "FALLBACK";
}

/**
 * Detects whether a stored customer name is a generic fallback or a legitimate display name.
 */
export function isFallbackCustomerName(name?: string | null): boolean {
  if (!name || !name.trim()) return true;
  const n = name.trim();
  return (
    /^Facebook\s+User/i.test(n) ||
    /^Instagram\s+User/i.test(n) ||
    /^TikTok\s+User/i.test(n) ||
    /^WhatsApp\s*\(/i.test(n) ||
    /^WhatsApp\s+User/i.test(n) ||
    /^Telegram\s+User/i.test(n) ||
    /^Guest\s*\(/i.test(n) ||
    /^Guest$/i.test(n) ||
    /^Anonymous/i.test(n) ||
    /^Practice\s+Customer/i.test(n) ||
    /^Unknown\s+User/i.test(n) ||
    /^Unknown\s+Customer/i.test(n) ||
    /^User\s*\(/i.test(n) ||
    /^Customer\s*\(/i.test(n)
  );
}

/**
 * Returns a polite customer greeting token.
 * If the customer has a real name (e.g. "Rolex Esto"), returns " Rolex".
 * If the customer is a fallback (e.g. "Facebook User (377892)"), returns "" to prevent "Hello po Facebook!".
 */
export function formatCustomerGreetingName(name?: string | null): string {
  if (!name || isFallbackCustomerName(name)) {
    return "";
  }
  const cleanFirst = name.trim().split(" ")[0];
  if (!cleanFirst || isFallbackCustomerName(cleanFirst)) {
    return "";
  }
  return ` ${cleanFirst}`;
}

export class SocialIdentityResolver {
  /**
   * Resolves the best legitimate customer identity available from webhook or platform Graph API.
   */
  public static async resolveIdentity(
    event: NormalizedMessageEvent,
    rawPageToken?: string | null,
    apiClient?: LivePlatformApiClient
  ): Promise<ResolvedCustomerIdentity> {
    const platform = event.platform;
    const senderExternalId = event.senderExternalId;

    // 1. Practice Simulator Environment
    if (event.environment === "PRACTICE" || senderExternalId?.startsWith("sim_")) {
      const isFallback = !event.senderName || isFallbackCustomerName(event.senderName);
      return {
        name: event.senderName || "Practice Customer",
        handle: event.senderHandle,
        phone: event.senderPhone,
        email: event.senderEmail,
        isFallback,
        source: "SIMULATOR",
      };
    }

    // 2. WhatsApp: Contact profile name is delivered directly in webhook payload
    if (platform === "WHATSAPP") {
      const isFallback = !event.senderName || isFallbackCustomerName(event.senderName);
      return {
        name: event.senderName || `WhatsApp (+${senderExternalId})`,
        phone: event.senderPhone || (senderExternalId ? `+${senderExternalId}` : undefined),
        isFallback,
        source: isFallback ? "FALLBACK" : "WEBHOOK_PAYLOAD",
      };
    }

    // 3. TikTok: Provided if enterprise developer whitelisted
    if (platform === "TIKTOK") {
      const isFallback = !event.senderName || isFallbackCustomerName(event.senderName);
      return {
        name: event.senderName || `TikTok User (${senderExternalId?.substring(0, 6) || "Guest"})`,
        handle: event.senderHandle,
        isFallback,
        source: isFallback ? "FALLBACK" : "WEBHOOK_PAYLOAD",
      };
    }

    // 4. Facebook & Instagram: Attempt Live Graph API User Profile Query
    if ((platform === "FACEBOOK" || platform === "INSTAGRAM") && senderExternalId && rawPageToken) {
      try {
        const client = apiClient || new LivePlatformApiClient();
        const profileResult: UserProfileLookupResult = await client.fetchUserProfile(
          platform,
          rawPageToken,
          senderExternalId
        );

        if (profileResult.success && profileResult.name) {
          return {
            name: profileResult.name,
            handle: profileResult.handle || event.senderHandle,
            avatarUrl: profileResult.avatarUrl,
            isFallback: false,
            source: "GRAPH_API",
          };
        }
      } catch {
        // Fail safely and preserve truthful fallback
      }
    }

    // 5. Fallback or provided legitimate sender name
    const hasLegitSenderName = Boolean(event.senderName && !isFallbackCustomerName(event.senderName));
    const resolvedName = hasLegitSenderName
      ? event.senderName!
      : `${platform === "FACEBOOK" ? "Facebook" : "Instagram"} User (${senderExternalId?.substring(0, 6) || "Guest"})`;

    return {
      name: resolvedName,
      handle: event.senderHandle,
      isFallback: !hasLegitSenderName,
      source: hasLegitSenderName ? "WEBHOOK_PAYLOAD" : "FALLBACK",
    };
  }
}
