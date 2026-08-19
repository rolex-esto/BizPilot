import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PlanTier, getEffectivePlan, PlanConfig } from "@/lib/plans";

/**
 * Plan enforcement guard for API routes.
 *
 * Checks whether the business's current plan allows an operation.
 * Returns the effective plan config or an error response.
 *
 * Usage:
 *   const { plan, errorResponse } = await checkPlanAccess(businessId);
 *   if (errorResponse) return errorResponse;
 *   // plan is guaranteed non-null, use plan.limits and plan.features
 */
export async function checkPlanAccess(businessId: string): Promise<{
  plan: PlanConfig | null;
  subscriptionStatus: string;
  errorResponse: NextResponse | null;
}> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      subscriptionStatus: true,
      planTier: true,
      trialEndsAt: true,
    },
  });

  if (!business) {
    return {
      plan: null,
      subscriptionStatus: "NONE",
      errorResponse: NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      ),
    };
  }

  // Determine effective subscription status (handle expired trial)
  let effectiveStatus = business.subscriptionStatus;
  if (effectiveStatus === "TRIAL" && business.trialEndsAt) {
    const daysLeft = Math.ceil(
      (business.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysLeft <= 0) {
      effectiveStatus = "EXPIRED";
    }
  }

  // Expired or cancelled users cannot create new resources
  if (effectiveStatus === "EXPIRED" || effectiveStatus === "CANCELLED") {
    return {
      plan: null,
      subscriptionStatus: effectiveStatus,
      errorResponse: NextResponse.json(
        {
          error: "Your subscription has expired. Please choose a plan to continue.",
          code: "SUBSCRIPTION_EXPIRED",
          upgradeUrl: "/pricing",
        },
        { status: 403 }
      ),
    };
  }

  const plan = getEffectivePlan(effectiveStatus, business.planTier as PlanTier);

  return {
    plan,
    subscriptionStatus: effectiveStatus,
    errorResponse: null,
  };
}

/**
 * Check if product creation is allowed under the current plan's product limit.
 * Returns null if allowed, or a NextResponse error if blocked.
 */
export async function checkProductLimit(businessId: string): Promise<NextResponse | null> {
  const { plan, errorResponse } = await checkPlanAccess(businessId);
  if (errorResponse) return errorResponse;

  if (plan!.limits.maxProducts === null) {
    // Unlimited
    return null;
  }

  const currentCount = await prisma.product.count({
    where: { businessId, isActive: true },
  });

  if (currentCount >= plan!.limits.maxProducts) {
    return NextResponse.json(
      {
        error: `You've reached the ${plan!.limits.maxProducts}-product limit on your ${plan!.name} plan. Upgrade to add more products.`,
        code: "PRODUCT_LIMIT_REACHED",
        currentCount,
        maxAllowed: plan!.limits.maxProducts,
        upgradeUrl: "/pricing",
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Check if order creation is allowed under the current plan's monthly order limit.
 * Returns null if allowed, or a NextResponse error if blocked.
 */
export async function checkOrderLimit(businessId: string): Promise<NextResponse | null> {
  const { plan, errorResponse } = await checkPlanAccess(businessId);
  if (errorResponse) return errorResponse;

  if (plan!.limits.maxOrdersPerMonth === null) {
    // Unlimited
    return null;
  }

  // Count orders created this calendar month (server time, Asia/Manila)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const monthlyOrderCount = await prisma.order.count({
    where: {
      businessId,
      createdAt: {
        gte: startOfMonth,
        lt: startOfNextMonth,
      },
    },
  });

  if (monthlyOrderCount >= plan!.limits.maxOrdersPerMonth) {
    return NextResponse.json(
      {
        error: `You've reached the ${plan!.limits.maxOrdersPerMonth} orders/month limit on your ${plan!.name} plan. Upgrade for unlimited orders.`,
        code: "ORDER_LIMIT_REACHED",
        currentMonthlyCount: monthlyOrderCount,
        maxAllowed: plan!.limits.maxOrdersPerMonth,
        upgradeUrl: "/pricing",
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Check if a specific feature is available on the current plan.
 * Returns null if allowed, or a NextResponse error if blocked.
 */
export async function checkFeatureAccess(
  businessId: string,
  feature: keyof PlanConfig["features"],
  featureLabel?: string
): Promise<NextResponse | null> {
  const { plan, errorResponse } = await checkPlanAccess(businessId);
  if (errorResponse) return errorResponse;

  const featureValue = plan!.features[feature];

  // Boolean features
  if (typeof featureValue === "boolean" && !featureValue) {
    const label = featureLabel || feature;
    return NextResponse.json(
      {
        error: `${label} is not available on your ${plan!.name} plan. Upgrade to access this feature.`,
        code: "FEATURE_NOT_AVAILABLE",
        feature,
        currentPlan: plan!.id,
        upgradeUrl: "/pricing",
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Check if a social platform account connection is allowed under current plan entitlements.
 */
export async function checkChannelLimit(
  businessId: string,
  platform: string,
  platformAccountId?: string
): Promise<NextResponse | null> {
  const { SubscriptionEntitlementService } = await import("./subscription-entitlement");
  return SubscriptionEntitlementService.validateConnectionEntitlement(
    businessId,
    platform,
    platformAccountId
  );
}
