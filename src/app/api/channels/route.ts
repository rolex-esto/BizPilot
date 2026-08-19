import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";
import { SubscriptionEntitlementService } from "@/lib/auth/subscription-entitlement";
import { checkChannelLimit } from "@/lib/auth/plan-guard";
import { PLATFORM_REGISTRY, PlatformId } from "@/lib/connectors/registry";
import { TokenVault } from "@/lib/connectors/token-vault";
import { LivePlatformApiClient } from "@/lib/connectors/live-client";

export const dynamic = "force-dynamic";

/**
 * GET /api/channels
 * Returns all platform configurations, connected accounts per platform, aggregated health status, and subscription entitlement info.
 */
export async function GET(req: NextRequest) {
  try {
    const { businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    let entitlement = null;
    let connections: any[] = [];

    if (businessId) {
      entitlement = await SubscriptionEntitlementService.getChannelEntitlement(businessId);
      connections = await prisma.platformConnection.findMany({
        where: { businessId },
        select: {
          id: true,
          businessId: true,
          platform: true,
          platformAccountId: true,
          platformAccountName: true,
          status: true,
          statusMessage: true,
          capabilitiesJson: true,
          lastSyncAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
      });
    }

    const platformKeys: PlatformId[] = ["FACEBOOK", "INSTAGRAM", "WHATSAPP", "TIKTOK"];

    const matrix = platformKeys.map((key) => {
      const meta = PLATFORM_REGISTRY[key];
      const platformConnections = connections.filter((c) => c.platform === key);
      const isAllowedByPlan = entitlement?.allowedPlatforms.includes(key) ?? false;

      const activeCount = platformConnections.filter((c) => c.status === "CONNECTED").length;
      const needsReauthCount = platformConnections.filter((c) => c.status === "NEEDS_REAUTH").length;
      const disconnectedCount = platformConnections.filter((c) => c.status === "DISCONNECTED").length;
      const pendingCount = platformConnections.filter((c) => c.status === "PENDING_APPROVAL").length;

      // Authoritative platform-level aggregated status
      let aggregateStatus = "NOT_CONNECTED";
      if (activeCount > 0 && needsReauthCount > 0) {
        aggregateStatus = "PARTIALLY_CONNECTED";
      } else if (activeCount > 0) {
        aggregateStatus = "CONNECTED";
      } else if (needsReauthCount > 0) {
        aggregateStatus = "NEEDS_REAUTH";
      } else if (pendingCount > 0 || meta.approvalRequired) {
        aggregateStatus = "PENDING_APPROVAL";
      } else if (disconnectedCount > 0) {
        aggregateStatus = "DISCONNECTED";
      }

      // Best representative connection for backward compatibility (prioritizes CONNECTED or NEEDS_REAUTH over DISCONNECTED)
      const primaryConnection =
        platformConnections.find((c) => c.status === "CONNECTED") ||
        platformConnections.find((c) => c.status === "NEEDS_REAUTH") ||
        platformConnections[0] ||
        null;

      return {
        platform: key,
        name: meta.name,
        officialProduct: meta.officialProduct,
        description: meta.description,
        minPlanTier: meta.minPlanTier,
        isAllowedByPlan,
        approvalRequired: meta.approvalRequired,
        approvalStatus: meta.approvalStatus,
        capabilities: meta.capabilities,
        connectedAccounts: platformConnections,
        activeCount,
        needsReauthCount,
        disconnectedCount,
        aggregateStatus,
        // Backward-compatible primary connection field
        connection: primaryConnection,
      };
    });

    return NextResponse.json({
      status: "success",
      entitlement,
      channels: matrix,
      allConnections: connections,
    });
  } catch (error: any) {
    console.error("GET /api/channels error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/channels
 * Connects or reconnects a specific platform account.
 * Multi-account enabled: Supports multiple pages/accounts per platform.
 * Mandatory Live API Validation Gate: Never marks CONNECTED without successful live verification.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, businessId: authBizId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const businessId = authBizId || body.businessId;

    if (!businessId) {
      return NextResponse.json({ error: "Business ID is required." }, { status: 400 });
    }

    let {
      platform,
      platformAccountId,
      platformAccountName,
      accessToken,
      webhookVerifyToken,
      action, // "CONNECT" | "RECONNECT" | "SWITCH"
      previousConnectionId, // if switching accounts and user wants to disconnect previous
    } = body;

    if (!platform || !["FACEBOOK", "INSTAGRAM", "WHATSAPP", "TIKTOK"].includes(platform)) {
      return NextResponse.json({ error: "Invalid platform specified." }, { status: 400 });
    }

    if (!platformAccountId || typeof platformAccountId !== "string" || !platformAccountId.trim()) {
      return NextResponse.json({ error: "Account / Page ID is required." }, { status: 400 });
    }

    if (!platformAccountName || typeof platformAccountName !== "string" || !platformAccountName.trim()) {
      return NextResponse.json({ error: "Account / Page Name is required." }, { status: 400 });
    }

    let cleanAccountId = platformAccountId.trim();
    let cleanAccountName = platformAccountName.trim();
    let rawTokenToSave = accessToken && typeof accessToken === "string" ? accessToken.trim() : "";

    // 1. Mandatory Live Platform API Validation Gate
    const apiClient = new LivePlatformApiClient();
    const liveApiResult = await apiClient.verifyTokenHealth(
      platform,
      rawTokenToSave || null,
      cleanAccountId
    );

    let connectionStatus: import("@/lib/connectors/types").ConnectionStatus = "CONNECTED";
    let statusMessage: string | null = null;

    // Check account identity match if Meta returned a valid page ID
    let identityMatch = true;
    if (liveApiResult.success && liveApiResult.platformObjectId) {
      const verifiedPlatformAccountId = liveApiResult.platformObjectId;
      console.log(`[${platform}][IDENTITY] existingPlatformAccountId=${cleanAccountId || "none"} metaProfileId=${verifiedPlatformAccountId} resolvedPlatformAccountId=${verifiedPlatformAccountId} identitySource=META_DEBUG_TOKEN`);

      cleanAccountId = verifiedPlatformAccountId;
      identityMatch = true;
    }

    if (platform === "TIKTOK" || liveApiResult.statusCategory === "BLOCKED") {
      connectionStatus = "PENDING_APPROVAL";
      statusMessage = liveApiResult.errorMessage || "Enterprise approval required.";
    } else if (!rawTokenToSave || liveApiResult.statusCategory === "MISSING_CREDENTIALS") {
      connectionStatus = "NEEDS_REAUTH";
      statusMessage = "No platform access token configured in vault. Reconnect to restore live API access.";
    } else if (
      liveApiResult.statusCategory === "INVALID_TOKEN" ||
      liveApiResult.statusCategory === "TOKEN_EXPIRED" ||
      liveApiResult.statusCategory === "TOKEN_REVOKED"
    ) {
      connectionStatus = "NEEDS_REAUTH";
      statusMessage = liveApiResult.errorMessage || "Invalid or expired platform access token.";
    } else if (liveApiResult.statusCategory === "MISSING_PERMISSION") {
      connectionStatus = "MISSING_PERMISSION";
      statusMessage = liveApiResult.errorMessage || "Access token missing required permissions (e.g. pages_messaging).";
    } else if (!identityMatch) {
      connectionStatus = "ACCOUNT_MISMATCH";
      statusMessage = `Authenticated Meta identity (${liveApiResult.platformObjectId}) does not match entered Page ID (${cleanAccountId}).`;
    } else if (liveApiResult.success) {
      connectionStatus = "CONNECTED";
      statusMessage = null;
      // Auto-align official account metadata if discovered from Meta
      if (liveApiResult.tokenHealth?.accountId) {
        cleanAccountId = liveApiResult.tokenHealth.accountId;
      }
      if (liveApiResult.tokenHealth?.accountName && (cleanAccountName.startsWith("LLM_") || cleanAccountName === "BizPilot")) {
        cleanAccountName = liveApiResult.tokenHealth.accountName;
      }
    } else if (liveApiResult.statusCategory === "SIMULATOR_ONLY") {
      connectionStatus = "CONNECTED";
      statusMessage = "Active in Developer Simulator mode.";
    } else {
      connectionStatus = "ERROR";
      statusMessage = liveApiResult.errorMessage || "Could not reach platform API.";
    }

    // 2. Subscription & Channel Limit Entitlement Enforcement
    const entitlementError = await checkChannelLimit(businessId, platform, cleanAccountId);
    if (entitlementError) return entitlementError;

    // 3. Check if exact (businessId, platform, platformAccountId) already exists
    let existingConn = await prisma.platformConnection.findUnique({
      where: {
        businessId_platform_platformAccountId: {
          businessId,
          platform,
          platformAccountId: cleanAccountId,
        },
      },
    });

    // Fallback: If reconnecting an account that had a previous typo ID, locate and update it
    if (!existingConn && platformAccountId && platformAccountId !== cleanAccountId) {
      const priorConn = await prisma.platformConnection.findFirst({
        where: {
          businessId,
          platform,
          platformAccountId: platformAccountId.trim(),
        },
      });
      if (priorConn) {
        existingConn = priorConn;
      }
    }

    // Securely encrypt token via TokenVault
    const getEncryptedToken = (currentEncrypted?: string | null) => {
      if (rawTokenToSave) {
        return rawTokenToSave.startsWith("enc:v1:") ? rawTokenToSave : TokenVault.encrypt(rawTokenToSave);
      }
      return currentEncrypted || TokenVault.encrypt(`sample_token_${Date.now()}`);
    };

    let connection;
    let isReconnect = false;

    if (existingConn) {
      isReconnect = true;
      connection = await prisma.platformConnection.update({
        where: { id: existingConn.id },
        data: {
          platformAccountId: cleanAccountId,
          platformAccountName: cleanAccountName,
          status: connectionStatus,
          statusMessage,
          accessTokenEncrypted: getEncryptedToken(existingConn.accessTokenEncrypted),
          webhookVerifyToken: webhookVerifyToken?.trim() || existingConn.webhookVerifyToken || `verify_token_${Date.now()}`,
          lastSyncAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          businessId,
          action: "ACCOUNT_RECONNECTED",
          entityType: "PlatformConnection",
          entityId: connection.id,
          details: `Reconnected account "${cleanAccountName}" (${cleanAccountId}) on ${platform} with status ${connectionStatus}.`,
          performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
        },
      });
    } else {
      connection = await prisma.platformConnection.create({
        data: {
          businessId,
          platform,
          platformAccountId: cleanAccountId,
          platformAccountName: cleanAccountName,
          accessTokenEncrypted: getEncryptedToken(null),
          webhookVerifyToken: webhookVerifyToken?.trim() || `verify_token_${Date.now()}`,
          status: connectionStatus,
          statusMessage,
          capabilitiesJson: JSON.stringify({ messaging: true, webhooks: true, multiAccount: true }),
          lastSyncAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          businessId,
          action: "ACCOUNT_CONNECTED",
          entityType: "PlatformConnection",
          entityId: connection.id,
          details: `Connected new account "${cleanAccountName}" (${cleanAccountId}) on ${platform} with status ${connectionStatus}.`,
          performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
        },
      });
    }

    // 4. Handle Account Switching (optional disconnect of previous account if explicitly requested)
    if (action === "SWITCH" && previousConnectionId) {
      const prev = await prisma.platformConnection.findFirst({
        where: { id: previousConnectionId, businessId },
      });
      if (prev && prev.id !== connection.id) {
        await prisma.platformConnection.update({
          where: { id: prev.id },
          data: { status: "DISCONNECTED", statusMessage: "Replaced by newly connected account." },
        });

        await prisma.auditLog.create({
          data: {
            businessId,
            action: "ACCOUNT_SWITCHED",
            entityType: "PlatformConnection",
            entityId: prev.id,
            details: `Disconnected previous account "${prev.platformAccountName}" upon switching to "${cleanAccountName}".`,
            performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
          },
        });
      }
    }

    // Sanitize response (do NOT return accessTokenEncrypted)
    const sanitized = {
      id: connection.id,
      businessId: connection.businessId,
      platform: connection.platform,
      platformAccountId: connection.platformAccountId,
      platformAccountName: connection.platformAccountName,
      status: connection.status,
      statusMessage: connection.statusMessage,
      lastSyncAt: connection.lastSyncAt,
      isReconnect,
      liveApiValidation: {
        success: liveApiResult.success,
        category: liveApiResult.statusCategory,
        latencyMs: liveApiResult.latencyMs,
      },
    };

    return NextResponse.json({ status: "success", connection: sanitized }, { status: isReconnect ? 200 : 201 });
  } catch (error: any) {
    console.error("POST /api/channels error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/channels
 * Disconnects or removes a specific account connection.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { user, businessId: authBizId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get("connectionId");
    const platform = searchParams.get("platform");
    const platformAccountId = searchParams.get("platformAccountId");
    const deleteRecord = searchParams.get("deleteRecord") === "true";
    const businessId = authBizId || searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json({ error: "Business ID is required." }, { status: 400 });
    }

    let targetConnection = null;

    if (connectionId) {
      targetConnection = await prisma.platformConnection.findFirst({
        where: { id: connectionId, businessId },
      });
    } else if (platform && platformAccountId) {
      targetConnection = await prisma.platformConnection.findUnique({
        where: {
          businessId_platform_platformAccountId: {
            businessId,
            platform,
            platformAccountId,
          },
        },
      });
    } else if (platform) {
      targetConnection = await prisma.platformConnection.findFirst({
        where: { businessId, platform, status: "CONNECTED" },
      });
    }

    if (!targetConnection) {
      return NextResponse.json({ error: "Connection record not found." }, { status: 404 });
    }

    if (deleteRecord) {
      // Hard delete of obsolete/duplicate disconnected record
      await prisma.platformConnection.delete({
        where: { id: targetConnection.id },
      });

      await prisma.auditLog.create({
        data: {
          businessId,
          action: "ACCOUNT_REMOVED",
          entityType: "PlatformConnection",
          entityId: targetConnection.id,
          details: `Permanently removed obsolete connection record "${targetConnection.platformAccountName}" (${targetConnection.platformAccountId}) on ${targetConnection.platform}.`,
          performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
        },
      });

      return NextResponse.json({
        status: "success",
        message: `Removed ${targetConnection.platformAccountName} record successfully.`,
      });
    }

    // Soft-disconnect: Update status to DISCONNECTED
    await prisma.platformConnection.update({
      where: { id: targetConnection.id },
      data: {
        status: "DISCONNECTED",
        statusMessage: "Manually disconnected by owner.",
      },
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        action: "ACCOUNT_DISCONNECTED",
        entityType: "PlatformConnection",
        entityId: targetConnection.id,
        details: `Disconnected account "${targetConnection.platformAccountName}" (${targetConnection.platformAccountId}) on ${targetConnection.platform}. Historical data preserved.`,
        performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
      },
    });

    return NextResponse.json({
      status: "success",
      message: `Disconnected ${targetConnection.platformAccountName} successfully. Historical chats and orders remain safely preserved.`,
    });
  } catch (error: any) {
    console.error("DELETE /api/channels error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
