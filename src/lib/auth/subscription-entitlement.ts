/**
 * Subscription Entitlement & Governance Service
 * 
 * Centralized authority for subscription entitlements, channel usage limits,
 * multi-account governance, and plan-aware lifecycle management.
 */

import { NextResponse } from "next/server";
import { prisma } from "../prisma";
import { PlanTier, PlanConfig, getEffectivePlan } from "../plans";
import { checkPlanAccess } from "./plan-guard";
import { getPlatformMetadata } from "../connectors/registry";

export interface ChannelEntitlementSummary {
  planTier: PlanTier;
  planName: string;
  subscriptionStatus: string;
  connectedCount: number;
  maxAllowed: number | null;
  remainingSlots: number | null;
  canConnectAnother: boolean;
  allowedPlatforms: string[];
  suspendedCount: number;
}

export class SubscriptionEntitlementService {
  /**
   * Get comprehensive channel entitlement and usage summary for a business
   */
  public static async getChannelEntitlement(businessId: string): Promise<ChannelEntitlementSummary> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        subscriptionStatus: true,
        planTier: true,
        trialEndsAt: true,
        isLifetimeFree: true,
      },
    });

    if (!business) {
      throw new Error("Business not found.");
    }

    // Determine effective status (handle trial, lifetime)
    let effectiveStatus = business.subscriptionStatus;
    if (business.isLifetimeFree || effectiveStatus === "LIFETIME") {
      effectiveStatus = "LIFETIME";
    } else if (effectiveStatus === "TRIAL" && business.trialEndsAt) {
      const daysLeft = Math.ceil((business.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 0) {
        effectiveStatus = "EXPIRED";
      }
    }

    const plan = getEffectivePlan(effectiveStatus, business.planTier as PlanTier);

    // Count actively connected channels
    const [connectedCount, suspendedCount] = await Promise.all([
      prisma.platformConnection.count({
        where: { businessId, status: "CONNECTED" },
      }),
      prisma.platformConnection.count({
        where: { businessId, status: "SUSPENDED_BY_PLAN" },
      }),
    ]);

    const maxAllowed = plan.limits.maxConnectedChannels;
    const remainingSlots = maxAllowed === null ? null : Math.max(0, maxAllowed - connectedCount);
    const canConnectAnother = maxAllowed === null ? true : connectedCount < maxAllowed;

    return {
      planTier: plan.id,
      planName: plan.name,
      subscriptionStatus: effectiveStatus,
      connectedCount,
      maxAllowed,
      remainingSlots,
      canConnectAnother,
      allowedPlatforms: plan.features.allowedPlatforms,
      suspendedCount,
    };
  }

  /**
   * Validate if a business is allowed to connect an account for a given platform.
   * Returns null if allowed, or a NextResponse error if blocked by plan governance.
   */
  public static async validateConnectionEntitlement(
    businessId: string,
    platform: string,
    platformAccountId?: string
  ): Promise<NextResponse | null> {
    const { plan, subscriptionStatus, errorResponse } = await checkPlanAccess(businessId);
    if (errorResponse) return errorResponse;

    const targetPlatform = platform.toUpperCase() as "FACEBOOK" | "INSTAGRAM" | "WHATSAPP" | "TIKTOK";

    // 1. Check Platform Eligibility in Plan
    if (!plan!.features.allowedPlatforms.includes(targetPlatform)) {
      const meta = getPlatformMetadata(platform);
      const minPlan = meta?.minPlanTier || "PRO";
      return NextResponse.json(
        {
          error: `${meta?.name || platform} is not available on your ${plan!.name} plan. Upgrade to ${minPlan} to connect this channel.`,
          code: "PLATFORM_NOT_IN_PLAN",
          platform: targetPlatform,
          currentPlan: plan!.id,
          requiredPlan: minPlan,
          upgradeUrl: "/pricing",
        },
        { status: 403 }
      );
    }

    // 2. Check if Reconnecting an existing connection (already in DB)
    let isExistingActive = false;
    if (platformAccountId) {
      const existing = await prisma.platformConnection.findUnique({
        where: {
          businessId_platform_platformAccountId: {
            businessId,
            platform: targetPlatform,
            platformAccountId: platformAccountId.trim(),
          },
        },
      });
      if (existing && existing.status === "CONNECTED") {
        isExistingActive = true;
      }
    }

    // 3. If connecting a NEW account or restoring a disconnected one, check Max Connection Limit
    if (!isExistingActive && plan!.limits.maxConnectedChannels !== null) {
      const currentConnectedCount = await prisma.platformConnection.count({
        where: { businessId, status: "CONNECTED" },
      });

      if (currentConnectedCount >= plan!.limits.maxConnectedChannels) {
        return NextResponse.json(
          {
            error: `You have reached your limit of ${plan!.limits.maxConnectedChannels} connected channel(s) on your ${plan!.name} plan. Disconnect an existing channel or upgrade your plan to connect more accounts.`,
            code: "CHANNEL_LIMIT_REACHED",
            currentConnectedCount,
            maxAllowed: plan!.limits.maxConnectedChannels,
            upgradeUrl: "/pricing",
          },
          { status: 403 }
        );
      }
    }

    return null;
  }

  /**
   * Gracefully handle subscription downgrade by suspending excess channels without deleting data
   */
  public static async handlePlanDowngrade(businessId: string, newPlanTier: PlanTier) {
    const newPlan = getEffectivePlan("ACTIVE", newPlanTier);
    const maxChannels = newPlan.limits.maxConnectedChannels;

    if (maxChannels === null) return; // Unlimited on new plan

    const activeConnections = await prisma.platformConnection.findMany({
      where: { businessId, status: "CONNECTED" },
      orderBy: { createdAt: "asc" },
    });

    if (activeConnections.length > maxChannels) {
      const toSuspend = activeConnections.slice(maxChannels);
      const suspendIds = toSuspend.map((c) => c.id);

      await prisma.platformConnection.updateMany({
        where: { id: { in: suspendIds } },
        data: {
          status: "SUSPENDED_BY_PLAN",
          statusMessage: `Account suspended due to plan limit (${newPlan.name} plan: max ${maxChannels} channel). Upgrade or manage active channels.`,
        },
      });

      await prisma.auditLog.create({
        data: {
          businessId,
          action: "ACCOUNT_SUSPENDED_BY_PLAN",
          entityType: "PlatformConnection",
          entityId: suspendIds.join(","),
          details: `Suspended ${suspendIds.length} excess platform account(s) due to downgrade to ${newPlan.name}. Historical data preserved.`,
          performedBy: "SYSTEM",
        },
      });
    }
  }

  /**
   * Restore suspended channels upon plan upgrade
   */
  public static async handlePlanUpgrade(businessId: string, newPlanTier: PlanTier) {
    const newPlan = getEffectivePlan("ACTIVE", newPlanTier);
    const maxChannels = newPlan.limits.maxConnectedChannels;

    const suspended = await prisma.platformConnection.findMany({
      where: { businessId, status: "SUSPENDED_BY_PLAN" },
      orderBy: { createdAt: "asc" },
    });

    if (suspended.length === 0) return;

    const currentConnected = await prisma.platformConnection.count({
      where: { businessId, status: "CONNECTED" },
    });

    const availableSlots = maxChannels === null ? suspended.length : Math.max(0, maxChannels - currentConnected);
    const toReactivate = suspended.slice(0, availableSlots);

    if (toReactivate.length > 0) {
      const reactivateIds = toReactivate.map((c) => c.id);
      await prisma.platformConnection.updateMany({
        where: { id: { in: reactivateIds } },
        data: {
          status: "CONNECTED",
          statusMessage: null,
          lastSyncAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          businessId,
          action: "ACCOUNT_REACTIVATED",
          entityType: "PlatformConnection",
          entityId: reactivateIds.join(","),
          details: `Reactivated ${reactivateIds.length} platform account(s) following upgrade to ${newPlan.name}.`,
          performedBy: "SYSTEM",
        },
      });
    }
  }
}
