import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/stats
 * Centralized Command Center Analytics & Attention Alerts
 * All numbers are dynamically queried and aggregated from real database records.
 */
export async function GET(req: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      businessCount,
      newBusinessesThisMonth,
      userCount,
      verifiedUserCount,
      productCount,
      orderCount,
      ordersThisMonth,
      ordersToday,
      customerCount,
      businesses,
      paidPaymentsThisMonth,
      channelsNeedingAttention,
      orderStatusCounts,
    ] = await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.user.count(),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.product.count(),
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.customer.count(),
      prisma.business.findMany({
        select: {
          id: true,
          name: true,
          ownerName: true,
          email: true,
          planTier: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              products: true,
              orders: true,
              customers: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.payment.aggregate({
        where: {
          status: "PAID",
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
      prisma.platformConnection.count({
        where: {
          status: { in: ["NEEDS_REAUTH", "PENDING_APPROVAL", "DISCONNECTED"] },
        },
      }),
      prisma.order.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    // Breakdown Plans & Subscriptions
    const activeTrials = businesses.filter((b) => b.subscriptionStatus === "TRIAL").length;
    const paidSubscriptions = businesses.filter((b) => b.subscriptionStatus === "ACTIVE").length;
    const expiredSubscriptions = businesses.filter((b) => b.subscriptionStatus === "EXPIRED").length;
    const cancelledSubscriptions = businesses.filter((b) => b.subscriptionStatus === "CANCELLED").length;

    const starterCount = businesses.filter((b) => b.planTier === "STARTER").length;
    const businessTierCount = businesses.filter((b) => b.planTier === "BUSINESS").length;
    const proTierCount = businesses.filter((b) => b.planTier === "PRO").length;

    // Real Monthly Revenue from verified store payments + active subscription calculation
    const storeProcessedRevenue = paidPaymentsThisMonth._sum.amount || 0;
    
    // Calculate platform MRR (Starter ₱499, Business ₱999, Pro ₱1999 for active non-lifetime)
    const platformMRR = businesses.reduce((acc, b) => {
      if (b.subscriptionStatus === "ACTIVE" && b.trialEndsAt !== null) {
        if (b.planTier === "STARTER") return acc + 499;
        if (b.planTier === "BUSINESS") return acc + 999;
        if (b.planTier === "PRO") return acc + 1999;
      }
      return acc;
    }, 0);

    // Filter "Trials Ending Soon"
    const trialsEndingSoon = businesses
      .filter((b) => b.subscriptionStatus === "TRIAL" && b.trialEndsAt)
      .map((b) => {
        const trialEnd = new Date(b.trialEndsAt!);
        const diffMs = trialEnd.getTime() - now.getTime();
        const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        return {
          id: b.id,
          name: b.name,
          ownerName: b.ownerName,
          planTier: b.planTier,
          trialEndsAt: b.trialEndsAt,
          daysLeft,
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);

    // Dynamic "Needs Your Attention" items
    const attentionAlerts: { id: string; type: "warning" | "info" | "alert"; title: string; actionText: string; targetTab: string }[] = [];

    const urgentTrials = trialsEndingSoon.filter((t) => t.daysLeft <= 3);
    if (urgentTrials.length > 0) {
      attentionAlerts.push({
        id: "urgent_trials",
        type: "warning",
        title: `${urgentTrials.length} store${urgentTrials.length > 1 ? "s have" : " has"} a trial ending in 3 days or less.`,
        actionText: "Review Trials",
        targetTab: "subscriptions",
      });
    }

    if (cancelledSubscriptions > 0) {
      attentionAlerts.push({
        id: "suspended_biz",
        type: "alert",
        title: `${cancelledSubscriptions} business${cancelledSubscriptions > 1 ? "es are" : " is"} currently suspended or cancelled.`,
        actionText: "Review Businesses",
        targetTab: "businesses",
      });
    }

    if (channelsNeedingAttention > 0) {
      attentionAlerts.push({
        id: "channels_attention",
        type: "warning",
        title: `${channelsNeedingAttention} messaging channel connection${channelsNeedingAttention > 1 ? "s need" : " needs"} attention.`,
        actionText: "Check Connections",
        targetTab: "channels",
      });
    }

    const unverifiedUsersCount = userCount - verifiedUserCount;
    if (unverifiedUsersCount > 0) {
      attentionAlerts.push({
        id: "unverified_users",
        type: "info",
        title: `${unverifiedUsersCount} registered user account${unverifiedUsersCount > 1 ? "s are" : " is"} awaiting email verification.`,
        actionText: "Manage Users",
        targetTab: "people",
      });
    }

    // Order status map
    const orderStatusMap: Record<string, number> = {};
    orderStatusCounts.forEach((s) => {
      orderStatusMap[s.status] = s._count.id;
    });

    return NextResponse.json({
      status: "success",
      stats: {
        totalBusinesses: businessCount,
        newBusinessesThisMonth,
        totalUsers: userCount,
        activeUsers: verifiedUserCount,
        unverifiedUsers: unverifiedUsersCount,
        totalProducts: productCount,
        totalOrders: orderCount,
        ordersThisMonth,
        ordersToday,
        totalCustomers: customerCount,
        activeTrials,
        paidSubscriptions,
        expiredSubscriptions,
        cancelledSubscriptions,
        starterCount,
        businessTierCount,
        proTierCount,
        storeProcessedRevenue,
        platformMRR,
        systemStatus: "HEALTHY",
        environment: process.env.NODE_ENV || "development",
        databaseType: "SQLite / Prisma ORM",
      },
      attentionAlerts,
      trialsEndingSoon,
      orderStatusBreakdown: {
        completed: (orderStatusMap["DELIVERED"] || 0) + (orderStatusMap["PICKED_UP"] || 0),
        pending: (orderStatusMap["PENDING"] || 0) + (orderStatusMap["CONFIRMED"] || 0) + (orderStatusMap["PACKED"] || 0),
        cancelled: orderStatusMap["CANCELLED"] || 0,
      },
      businesses,
    });
  } catch (error: any) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
