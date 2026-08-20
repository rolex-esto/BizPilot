/**
 * BizPilot Production-Grade Social Channel OAuth Manager
 * 
 * Manages official OAuth 2.0 authorization URL creation, authorization code exchange,
 * multi-page account discovery, webhook subscription, and token storage.
 */

import { TokenVault } from "./token-vault";
import { prisma } from "../prisma";
import { HistoryRestorer } from "./history-restorer";

export interface DiscoveredAccount {
  platformAccountId: string;
  platformAccountName: string;
  accessToken: string;
  category?: string;
  instagramBusinessAccountId?: string;
  instagramUsername?: string;
}

export class OAuthManager {
  private static readonly META_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v19.0";
  private static readonly META_GRAPH_URL = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";

  /**
   * Generates the official OAuth authorization URL for the target platform.
   */
  public static getAuthorizationUrl(params: {
    platform: string;
    state: string;
    redirectUri: string;
  }): { authUrl: string; isConfigured: boolean; warning?: string } {
    const platform = params.platform.toUpperCase();
    const metaAppId = process.env.META_APP_ID || process.env.META_CLIENT_ID || process.env.NEXT_PUBLIC_META_APP_ID;

    if (platform === "FACEBOOK") {
      if (!metaAppId) {
        // Return simulated sandbox authorization URL if in development/demo without live App ID
        return {
          authUrl: `/simulator?oauth_demo=FACEBOOK&state=${encodeURIComponent(params.state)}`,
          isConfigured: false,
          warning: "Meta App ID not configured in .env. Operating in Developer Sandbox mode.",
        };
      }
      const scopes = [
        "pages_show_list",
        "pages_messaging",
        "pages_read_engagement",
        "pages_manage_metadata",
        "public_profile",
      ].join(",");
      const url = `https://www.facebook.com/${this.META_GRAPH_VERSION}/dialog/oauth?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(params.redirectUri)}&state=${encodeURIComponent(params.state)}&scope=${encodeURIComponent(scopes)}&response_type=code`;
      return { authUrl: url, isConfigured: true };
    }

    if (platform === "INSTAGRAM") {
      if (!metaAppId) {
        return {
          authUrl: `/simulator?oauth_demo=INSTAGRAM&state=${encodeURIComponent(params.state)}`,
          isConfigured: false,
          warning: "Meta App ID not configured in .env. Operating in Developer Sandbox mode.",
        };
      }
      const scopes = [
        "instagram_basic",
        "instagram_manage_messages",
        "pages_show_list",
        "pages_read_engagement",
      ].join(",");
      const url = `https://www.facebook.com/${this.META_GRAPH_VERSION}/dialog/oauth?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(params.redirectUri)}&state=${encodeURIComponent(params.state)}&scope=${encodeURIComponent(scopes)}&response_type=code`;
      return { authUrl: url, isConfigured: true };
    }

    if (platform === "WHATSAPP") {
      if (!metaAppId) {
        return {
          authUrl: `/simulator?oauth_demo=WHATSAPP&state=${encodeURIComponent(params.state)}`,
          isConfigured: false,
          warning: "Meta App ID not configured in .env. Operating in Developer Sandbox mode.",
        };
      }
      const scopes = [
        "whatsapp_business_management",
        "whatsapp_business_messaging",
      ].join(",");
      const url = `https://www.facebook.com/${this.META_GRAPH_VERSION}/dialog/oauth?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(params.redirectUri)}&state=${encodeURIComponent(params.state)}&scope=${encodeURIComponent(scopes)}&response_type=code`;
      return { authUrl: url, isConfigured: true };
    }

    if (platform === "TIKTOK") {
      const tiktokKey = process.env.TIKTOK_CLIENT_KEY;
      if (!tiktokKey) {
        return {
          authUrl: `/channels?oauth_error=tiktok_approval_required&platform=TIKTOK`,
          isConfigured: false,
          warning: "TikTok Business Messaging requires ByteDance enterprise commercial partner approval.",
        };
      }
      const scopes = "user.info.basic,business.message";
      const url = `https://www.tiktok.com/v2/auth/authorize/?client_key=${tiktokKey}&scope=${encodeURIComponent(scopes)}&response_type=code&redirect_uri=${encodeURIComponent(params.redirectUri)}&state=${encodeURIComponent(params.state)}`;
      return { authUrl: url, isConfigured: true };
    }

    throw new Error(`Unsupported platform for OAuth: ${platform}`);
  }

  /**
   * Exchanges an authorization code for long-lived access tokens via Meta Graph API.
   */
  public static async exchangeCodeForUserToken(params: {
    platform: string;
    code: string;
    redirectUri: string;
  }): Promise<{ userAccessToken: string; expiresIn?: number }> {
    const metaAppId = process.env.META_APP_ID || process.env.META_CLIENT_ID;
    const metaAppSecret = process.env.META_APP_SECRET || process.env.META_CLIENT_SECRET;

    if (!metaAppId || !metaAppSecret || params.code.startsWith("sim_code_")) {
      // Demo / Simulator fallback
      return {
        userAccessToken: `sim_token_${params.platform.toLowerCase()}_${Date.now()}`,
        expiresIn: 5184000, // 60 days
      };
    }

    // 1. Exchange code for short-lived user token
    const tokenUrl = `${this.META_GRAPH_URL}/${this.META_GRAPH_VERSION}/oauth/access_token?client_id=${metaAppId}&client_secret=${metaAppSecret}&redirect_uri=${encodeURIComponent(params.redirectUri)}&code=${encodeURIComponent(params.code)}`;
    const res = await fetch(tokenUrl);
    const data = await res.json();

    if (!res.ok || data.error || !data.access_token) {
      throw new Error(data.error?.message || "Failed to exchange authorization code with Meta Graph API.");
    }

    const shortLivedToken = data.access_token;

    // 2. Exchange short-lived token for long-lived token (60-day)
    try {
      const longLivedUrl = `${this.META_GRAPH_URL}/${this.META_GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${metaAppId}&client_secret=${metaAppSecret}&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`;
      const longRes = await fetch(longLivedUrl);
      const longData = await longRes.json();
      if (longRes.ok && longData.access_token) {
        return {
          userAccessToken: longData.access_token,
          expiresIn: longData.expires_in || 5184000,
        };
      }
    } catch {
      // Fallback to short-lived token if exchange endpoint fails
    }

    return { userAccessToken: shortLivedToken, expiresIn: data.expires_in };
  }

  /**
   * Discovers all business Pages / Instagram accounts available to the authorized user.
   */
  public static async discoverAvailableAccounts(params: {
    platform: string;
    userAccessToken: string;
  }): Promise<DiscoveredAccount[]> {
    const platform = params.platform.toUpperCase();

    if (params.userAccessToken.startsWith("sim_token_")) {
      // Simulator demo accounts
      return [
        {
          platformAccountId: `page_${Date.now()}`,
          platformAccountName: "My Online Boutique Store",
          accessToken: params.userAccessToken,
          category: "Retail Store",
          instagramBusinessAccountId: `ig_${Date.now()}`,
          instagramUsername: "myboutique.ph",
        },
      ];
    }

    if (platform === "FACEBOOK" || platform === "INSTAGRAM") {
      const url = `${this.META_GRAPH_URL}/${this.META_GRAPH_VERSION}/me/accounts?fields=id,name,category,access_token,tasks,instagram_business_account{id,username}&access_token=${encodeURIComponent(params.userAccessToken)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error?.message || "Failed to retrieve Facebook Pages from Meta Graph API.");
      }

      const pages = data.data || [];
      const discovered: DiscoveredAccount[] = [];

      for (const p of pages) {
        if (platform === "INSTAGRAM") {
          if (p.instagram_business_account) {
            discovered.push({
              platformAccountId: p.instagram_business_account.id,
              platformAccountName: p.instagram_business_account.username || p.name,
              accessToken: p.access_token,
              category: p.category,
              instagramBusinessAccountId: p.instagram_business_account.id,
              instagramUsername: p.instagram_business_account.username,
            });
          }
        } else {
          discovered.push({
            platformAccountId: p.id,
            platformAccountName: p.name,
            accessToken: p.access_token,
            category: p.category,
            instagramBusinessAccountId: p.instagram_business_account?.id,
            instagramUsername: p.instagram_business_account?.username,
          });
        }
      }

      return discovered;
    }

    return [];
  }

  /**
   * Subscribes the Facebook Page to BizPilot's Webhook events.
   */
  public static async subscribePageWebhook(pageId: string, pageAccessToken: string): Promise<boolean> {
    if (pageAccessToken.startsWith("sim_")) return true;

    try {
      const url = `${this.META_GRAPH_URL}/${this.META_GRAPH_VERSION}/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_reads,message_deliveries&access_token=${encodeURIComponent(pageAccessToken)}`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      return Boolean(data.success);
    } catch {
      return false;
    }
  }

  /**
   * Securely saves or updates a PlatformConnection with encrypted tokens and triggers initial message restoration.
   */
  public static async saveConnectedAccount(params: {
    businessId: string;
    platform: string;
    account: DiscoveredAccount;
    webhookVerifyToken?: string;
  }) {
    const platform = params.platform.toUpperCase();
    const encryptedToken = TokenVault.encrypt(params.account.accessToken);
    const verifyToken = params.webhookVerifyToken || `bizpilot_${platform.toLowerCase()}_${Date.now()}`;

    // 1. Subscribe to Meta Webhooks
    let webhookActive = false;
    if (platform === "FACEBOOK" || platform === "INSTAGRAM") {
      webhookActive = await this.subscribePageWebhook(params.account.platformAccountId, params.account.accessToken);
    }

    // 2. Upsert PlatformConnection in Neon Database
    const connection = await prisma.platformConnection.upsert({
      where: {
        businessId_platform_platformAccountId: {
          businessId: params.businessId,
          platform,
          platformAccountId: params.account.platformAccountId,
        },
      },
      update: {
        platformAccountName: params.account.platformAccountName,
        accessTokenEncrypted: encryptedToken,
        webhookVerifyToken: verifyToken,
        status: "CONNECTED",
        statusMessage: webhookActive ? "Connected and subscribed to live webhooks" : "Connected (Webhook subscription pending)",
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        businessId: params.businessId,
        platform,
        platformAccountId: params.account.platformAccountId,
        platformAccountName: params.account.platformAccountName,
        accessTokenEncrypted: encryptedToken,
        webhookVerifyToken: verifyToken,
        status: "CONNECTED",
        statusMessage: webhookActive ? "Connected and subscribed to live webhooks" : "Connected (Webhook subscription pending)",
        lastSyncAt: new Date(),
      },
    });

    // 3. Trigger Asynchronous Initial Message Restoration (Non-blocking)
    HistoryRestorer.restoreRecentChannelHistory(connection.id, 10).catch((err) => {
      console.error("Background initial history restoration failed:", err);
    });

    return connection;
  }
}
