import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/api-guard";
import { getEffectivePlan, PLANS, PlanTier } from "@/lib/plans";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings
 * 
 * Fetches all settings for the currently authenticated business owner:
 * - Account details
 * - Business profile
 * - Notification preferences
 * - Communication preferences
 * - Subscription & Plan details
 * - Live usage statistics (products, monthly orders, staff)
 * - Active session details
 */
export async function GET(req: NextRequest) {
  try {
    const { user: authUser, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const user = await prisma.user.findUnique({
      where: { id: authUser!.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        businessId: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    let business = null;
    let effectivePlan = PLANS.STARTER;
    let channelEntitlement: any = null;
    let usage = {
      productCount: 0,
      maxProducts: PLANS.STARTER.limits.maxProducts,
      monthlyOrderCount: 0,
      maxMonthlyOrders: PLANS.STARTER.limits.maxOrdersPerMonth,
      staffCount: 1,
      maxStaffAccounts: PLANS.STARTER.limits.maxStaffAccounts,
      connectedChannelsCount: 0,
      maxConnectedChannels: PLANS.STARTER.limits.maxConnectedChannels,
      remainingChannelSlots: 1 as number | null,
      canConnectAnotherChannel: true,
    };

    if (user.businessId) {
      business = await prisma.business.findUnique({
        where: { id: user.businessId },
        select: {
          id: true,
          name: true,
          ownerName: true,
          email: true,
          contactNumber: true,
          address: true,
          currency: true,
          timezone: true,
          subscriptionStatus: true,
          isLifetimeFree: true,
          planTier: true,
          trialEndsAt: true,
          settingsJson: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (business) {
        const effectiveStatus = (business.isLifetimeFree || business.subscriptionStatus === "LIFETIME")
          ? "LIFETIME"
          : business.subscriptionStatus;

        effectivePlan = getEffectivePlan(effectiveStatus, business.planTier as PlanTier);

        // Product count
        const productCount = await prisma.product.count({
          where: { businessId: business.id, isActive: true },
        });

        // Monthly orders count
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const monthlyOrderCount = await prisma.order.count({
          where: {
            businessId: business.id,
            createdAt: {
              gte: startOfMonth,
              lt: startOfNextMonth,
            },
          },
        });

        // Channel entitlement
        const { SubscriptionEntitlementService } = await import("@/lib/auth/subscription-entitlement");
        channelEntitlement = await SubscriptionEntitlementService.getChannelEntitlement(business.id);

        usage = {
          productCount,
          maxProducts: effectivePlan.limits.maxProducts,
          monthlyOrderCount,
          maxMonthlyOrders: effectivePlan.limits.maxOrdersPerMonth,
          staffCount: 1,
          maxStaffAccounts: effectivePlan.limits.maxStaffAccounts,
          connectedChannelsCount: channelEntitlement.connectedCount,
          maxConnectedChannels: channelEntitlement.maxAllowed,
          remainingChannelSlots: channelEntitlement.remainingSlots,
          canConnectAnotherChannel: channelEntitlement.canConnectAnother,
        };
      }
    }

    // Parse business settings
    let parsedSettings: any = {};
    try {
      parsedSettings = business?.settingsJson ? JSON.parse(business.settingsJson) : {};
    } catch {
      parsedSettings = {};
    }

    // Active session count
    const sessionCount = await prisma.session.count({
      where: { userId: user.id },
    });

    const isLifetime = business ? (business.isLifetimeFree || business.subscriptionStatus === "LIFETIME") : false;
    const effectiveStatus = isLifetime ? "LIFETIME" : (business?.subscriptionStatus || "TRIAL");

    return NextResponse.json({
      status: "success",
      user,
      business: business
        ? {
            ...business,
            subscriptionStatus: effectiveStatus,
            isLifetimeFree: isLifetime,
            planTier: isLifetime ? "PRO" : business.planTier,
            trialEndsAt: isLifetime ? null : business.trialEndsAt,
            settings: {
              description: parsedSettings.description || "",
              category: parsedSettings.category || "General Retail",
              businessType: parsedSettings.businessType || "ONLINE_ONLY",
              logoUrl: parsedSettings.logoUrl || null,
              fulfillmentMethods: parsedSettings.fulfillmentOptions ||
                parsedSettings.fulfillmentMethods || [
                  "MEETUP",
                  "LBC",
                  "GRAB",
                  "LALAMOVE",
                  "DELIVERY",
                ],
              acceptedPaymentMethods: parsedSettings.acceptedPaymentMethods ||
                parsedSettings.acceptedPayments || [
                  "GCASH",
                  "MAYA",
                  "BANK_TRANSFER",
                  "COD",
                  "CASH",
                ],
              notifications: {
                customerMessages: parsedSettings.notifications?.customerMessages ?? true,
                newOrders: parsedSettings.notifications?.newOrders ?? true,
                paymentUpdates: parsedSettings.notifications?.paymentUpdates ?? true,
                orderStatus: parsedSettings.notifications?.orderStatus ?? true,
                lowStock: parsedSettings.notifications?.lowStock ?? true,
                trialReminders: true, // Required account notices
                subscription: true, // Required billing notices
                securityAlerts: true, // Required security notices
              },
              communication: {
                facebook: parsedSettings.communication?.facebook ?? true,
                instagram: parsedSettings.communication?.instagram ?? true,
                whatsapp: parsedSettings.communication?.whatsapp ?? true,
                tiktok: parsedSettings.communication?.tiktok ?? false,
              },
              pendingEmailChange: parsedSettings.pendingEmailChange || null,
            },
          }
        : null,
      plan: {
        id: effectivePlan.id,
        name: effectivePlan.name,
        price: effectivePlan.price,
        limits: effectivePlan.limits,
        features: effectivePlan.features,
      },
      usage,
      sessions: {
        totalActive: sessionCount,
      },
    });
  } catch (error: any) {
    console.error("Settings GET error:", error);
    return NextResponse.json(
      { error: "Could not load your settings. Please try again." },
      { status: 500 }
    );
  }
}
