/**
 * BizPilot Plan Configuration — Single Source of Truth
 *
 * All plan IDs, prices, limits, and feature flags are defined here.
 * The pricing page, API guards, and subscription logic all reference this file.
 *
 * IMPORTANT: If you change plan limits or features, update ONLY this file.
 */

export type PlanTier = "STARTER" | "BUSINESS" | "PRO";

export interface PlanConfig {
  id: PlanTier;
  name: string;
  price: number; // PHP per month
  limits: {
    maxProducts: number | null; // null = unlimited
    maxOrdersPerMonth: number | null; // null = unlimited
    maxStaffAccounts: number; // includes owner
    maxConnectedChannels: number | null; // null = unlimited (STARTER: 1, BUSINESS: 3, PRO: unlimited)
  };
  features: {
    messaging: boolean;
    allowedPlatforms: ("FACEBOOK" | "INSTAGRAM" | "WHATSAPP" | "TIKTOK")[];
    paymentTracking: ("GCASH" | "MAYA" | "COD" | "BANK_TRANSFER" | "CASH")[];
    scheduling: ("MEETUP" | "DELIVERY" | "LBC" | "GRAB" | "LALAMOVE" | "PICKUP" | "COURIER")[];
    aiAssistant: "BASIC" | "FULL";
    categoryManagement: boolean;
    lowStockAlerts: boolean;
    advancedReporting: boolean;
    customWorkflows: boolean;
    apiAccess: boolean;
  };
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    price: 499,
    limits: {
      maxProducts: 50,
      maxOrdersPerMonth: 100,
      maxStaffAccounts: 1, // owner only
      maxConnectedChannels: 1, // 1 connected account
    },
    features: {
      messaging: true,
      allowedPlatforms: ["FACEBOOK"],
      paymentTracking: ["GCASH", "MAYA", "COD"],
      scheduling: ["MEETUP", "DELIVERY"],
      aiAssistant: "BASIC",
      categoryManagement: false,
      lowStockAlerts: false,
      advancedReporting: false,
      customWorkflows: false,
      apiAccess: false,
    },
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    price: 999,
    limits: {
      maxProducts: null, // unlimited
      maxOrdersPerMonth: null, // unlimited
      maxStaffAccounts: 1, // owner only (multi-staff is Pro)
      maxConnectedChannels: 3, // up to 3 connected accounts
    },
    features: {
      messaging: true,
      allowedPlatforms: ["FACEBOOK", "INSTAGRAM", "WHATSAPP"],
      paymentTracking: ["GCASH", "MAYA", "COD", "BANK_TRANSFER"],
      scheduling: ["MEETUP", "DELIVERY", "LBC", "GRAB", "LALAMOVE", "PICKUP", "COURIER"],
      aiAssistant: "FULL",
      categoryManagement: true,
      lowStockAlerts: true,
      advancedReporting: false,
      customWorkflows: false,
      apiAccess: false,
    },
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    price: 1999,
    limits: {
      maxProducts: null, // unlimited
      maxOrdersPerMonth: null, // unlimited
      maxStaffAccounts: 10, // multiple staff
      maxConnectedChannels: null, // unlimited accounts
    },
    features: {
      messaging: true,
      allowedPlatforms: ["FACEBOOK", "INSTAGRAM", "WHATSAPP", "TIKTOK"],
      paymentTracking: ["GCASH", "MAYA", "COD", "BANK_TRANSFER", "CASH"],
      scheduling: ["MEETUP", "DELIVERY", "LBC", "GRAB", "LALAMOVE", "PICKUP", "COURIER"],
      aiAssistant: "FULL",
      categoryManagement: true,
      lowStockAlerts: true,
      advancedReporting: true,
      customWorkflows: true,
      apiAccess: true,
    },
  },
};

/**
 * Default plan for new subscriptions (after trial).
 * During trial, users get BUSINESS-level access (full features).
 */
export const TRIAL_PLAN_ACCESS: PlanTier = "BUSINESS";

/**
 * Get plan config by tier. Falls back to STARTER if unknown.
 */
export function getPlanConfig(tier: PlanTier | string | null | undefined): PlanConfig {
  if (tier && tier in PLANS) {
    return PLANS[tier as PlanTier];
  }
  return PLANS.STARTER;
}

/**
 * Get effective plan for a business based on subscription status and plan tier.
 * During TRIAL, users get BUSINESS-level access.
 * After EXPIRED, they get read-only (no new creates) but we still check against their selected plan.
 */
export function getEffectivePlan(
  subscriptionStatus: string,
  planTier: PlanTier | string | null | undefined
): PlanConfig {
  // Lifetime Access grants PRO tier features permanently
  if (subscriptionStatus === "LIFETIME") {
    return PLANS.PRO;
  }

  // During trial, give full BUSINESS-level access
  if (subscriptionStatus === "TRIAL") {
    return PLANS.BUSINESS;
  }

  // Active subscription — use their actual plan
  if (subscriptionStatus === "ACTIVE") {
    return getPlanConfig(planTier);
  }

  // Expired or cancelled — still use their plan for display, but enforcement
  // should block new creates entirely (handled at the guard level)
  return getPlanConfig(planTier);
}
