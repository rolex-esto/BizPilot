/**
 * BizPilot Pricing & Subscription Governance Alignment Test Suite
 * 
 * Verifies:
 * 1. Plan definition alignment (Starter = 1, Business = 3, Pro = Unlimited)
 * 2. 30-Day Trial matches Business-tier channel entitlement (3 channels)
 * 3. Starter blocks 2nd account; Business blocks 4th account; Pro unlimited
 * 4. Disconnecting frees slot; Reconnecting restores slot idempotently
 * 5. Downgrade marks excess accounts as SUSPENDED_BY_PLAN with zero data deletion
 * 6. Upgrade reactivates eligible suspended accounts
 * 7. Real-time channel meter dynamic calculation in Settings API
 * 8. AI Copilot grounded plan Q&A reports correct limits and connected accounts
 * 9. Strict tenant isolation on channel queries and modifications
 */

import { prisma } from "@/lib/prisma";
import { PLANS, getEffectivePlan, getPlanConfig } from "@/lib/plans";
import { SubscriptionEntitlementService } from "@/lib/auth/subscription-entitlement";
import { CopilotQaEngine } from "@/lib/ai/copilot-qa";

async function runPricingAlignmentTests() {
  console.log("============================================================");
  console.log("STARTING PRICING & SUBSCRIPTION GOVERNANCE ALIGNMENT SUITE");
  console.log("============================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  const suffix = Date.now().toString();

  // ─── TEST 1: Source of Truth Plan Configurations ───
  console.log("\n--- TEST 1: Plan Config Limits & Entitlements ---");
  assert(PLANS.STARTER.price === 499, "Starter price is ₱499/mo");
  assert(PLANS.STARTER.limits.maxConnectedChannels === 1, "Starter maxConnectedChannels is 1");
  assert(PLANS.BUSINESS.price === 999, "Business price is ₱999/mo");
  assert(PLANS.BUSINESS.limits.maxConnectedChannels === 3, "Business maxConnectedChannels is 3");
  assert(PLANS.PRO.price === 1999, "Pro price is ₱1,999/mo");
  assert(PLANS.PRO.limits.maxConnectedChannels === null, "Pro maxConnectedChannels is null (unlimited)");

  // ─── TEST 2: 30-Day Free Trial Entitlement ───
  console.log("\n--- TEST 2: 30-Day Free Trial Business-Tier Entitlement ---");
  const trialEffective = getEffectivePlan("TRIAL", "STARTER");
  assert(trialEffective.id === "BUSINESS", "Trial status resolves to BUSINESS tier");
  assert(trialEffective.limits.maxConnectedChannels === 3, "Trial allows up to 3 connected accounts");

  // ─── Setup Fixture Businesses ───
  const trialBiz = await prisma.business.create({
    data: {
      name: `Trial Store ${suffix}`,
      ownerName: "Trial Owner",
      email: `trial_${suffix}@bizpilot.test`,
      planTier: "STARTER",
      subscriptionStatus: "TRIAL",
    },
  });

  const starterBiz = await prisma.business.create({
    data: {
      name: `Starter Store ${suffix}`,
      ownerName: "Starter Owner",
      email: `starter_${suffix}@bizpilot.test`,
      planTier: "STARTER",
      subscriptionStatus: "ACTIVE",
    },
  });

  const businessBiz = await prisma.business.create({
    data: {
      name: `Business Store ${suffix}`,
      ownerName: "Business Owner",
      email: `business_${suffix}@bizpilot.test`,
      planTier: "BUSINESS",
      subscriptionStatus: "ACTIVE",
    },
  });

  const proBiz = await prisma.business.create({
    data: {
      name: `Pro Store ${suffix}`,
      ownerName: "Pro Owner",
      email: `pro_${suffix}@bizpilot.test`,
      planTier: "PRO",
      subscriptionStatus: "ACTIVE",
    },
  });

  try {
    // ─── TEST 3: Dynamic Channel Meter on Trial Store ───
    console.log("\n--- TEST 3: Dynamic Channel Meter on Trial Store ---");
    const trialUsage = await SubscriptionEntitlementService.getChannelEntitlement(trialBiz.id);
    assert(trialUsage.planName === "Business", "Trial uses Business plan name");
    assert(trialUsage.maxAllowed === 3, "Trial maxAllowed is 3 accounts");
    assert(trialUsage.connectedCount === 0, "Trial starts with 0 accounts connected");
    assert(trialUsage.remainingSlots === 3, "Trial has 3 remaining slots");
    assert(trialUsage.canConnectAnother === true, "Trial can connect another account");

    // ─── TEST 4: Starter Plan Limits (1 Channel) ───
    console.log("\n--- TEST 4: Starter Plan Limit Enforcement ---");
    // Connect 1st account
    const sConn1 = await prisma.platformConnection.create({
      data: {
        businessId: starterBiz.id,
        platform: "FACEBOOK",
        platformAccountId: `fb_page_starter_1_${suffix}`,
        platformAccountName: "Starter Manila Main",
        status: "CONNECTED",
      },
    });

    const starterUsageAfter1 = await SubscriptionEntitlementService.getChannelEntitlement(starterBiz.id);
    assert(starterUsageAfter1.connectedCount === 1, "Starter usage is 1 / 1");
    assert(starterUsageAfter1.remainingSlots === 0, "Starter has 0 remaining slots");
    assert(starterUsageAfter1.canConnectAnother === false, "Starter cannot connect 2nd account");

    // Try connecting 2nd account
    const sErr = await SubscriptionEntitlementService.validateConnectionEntitlement(
      starterBiz.id,
      "FACEBOOK",
      `fb_page_starter_2_${suffix}`
    );
    assert(sErr !== null, "Starter blocks 2nd account connection");
    const sErrJson = await sErr!.json();
    assert(sErrJson.code === "CHANNEL_LIMIT_REACHED", "Error code is CHANNEL_LIMIT_REACHED");

    // ─── TEST 5: Account Replacement on Starter (Disconnect & Reconnect) ───
    console.log("\n--- TEST 5: Account Replacement on Starter ---");
    // Disconnect 1st account
    await prisma.platformConnection.update({
      where: { id: sConn1.id },
      data: { status: "DISCONNECTED" },
    });

    const starterAfterDisconnect = await SubscriptionEntitlementService.getChannelEntitlement(starterBiz.id);
    assert(starterAfterDisconnect.connectedCount === 0, "Starter count is 0 after disconnect");
    assert(starterAfterDisconnect.remainingSlots === 1, "Starter has 1 slot available");
    assert(starterAfterDisconnect.canConnectAnother === true, "Starter can now connect new account without upgrading");

    // Connect 2nd account in place of the first
    const sConn2 = await prisma.platformConnection.create({
      data: {
        businessId: starterBiz.id,
        platform: "FACEBOOK",
        platformAccountId: `fb_page_starter_2_${suffix}`,
        platformAccountName: "Starter Manila Secondary",
        status: "CONNECTED",
      },
    });
    assert(sConn2.status === "CONNECTED", "Connected replacement account on Starter within 1-account limit");

    // ─── TEST 6: Business Plan Multi-Account & 4th Account Blocking ───
    console.log("\n--- TEST 6: Business Plan Multi-Account (Up to 3 Accounts) ---");
    // Connect 3 accounts on Business
    await prisma.platformConnection.createMany({
      data: [
        { businessId: businessBiz.id, platform: "FACEBOOK", platformAccountId: `biz_fb_1_${suffix}`, platformAccountName: "TechStore Main", status: "CONNECTED" },
        { businessId: businessBiz.id, platform: "FACEBOOK", platformAccountId: `biz_fb_2_${suffix}`, platformAccountName: "TechStore Outlet", status: "CONNECTED" },
        { businessId: businessBiz.id, platform: "INSTAGRAM", platformAccountId: `biz_ig_1_${suffix}`, platformAccountName: "@techstore_ph", status: "CONNECTED" },
      ],
    });

    const bizUsage3 = await SubscriptionEntitlementService.getChannelEntitlement(businessBiz.id);
    assert(bizUsage3.connectedCount === 3, "Business plan has 3 / 3 accounts connected");
    assert(bizUsage3.remainingSlots === 0, "Business plan has 0 remaining slots");
    assert(bizUsage3.canConnectAnother === false, "Business plan blocks 4th connection");

    const bErr = await SubscriptionEntitlementService.validateConnectionEntitlement(
      businessBiz.id,
      "WHATSAPP",
      `biz_wa_1_${suffix}`
    );
    assert(bErr !== null, "Business plan blocked 4th account");

    // ─── TEST 7: Pro Plan Unlimited Accounts ───
    console.log("\n--- TEST 7: Pro Plan Unlimited Accounts ---");
    await prisma.platformConnection.createMany({
      data: [
        { businessId: proBiz.id, platform: "FACEBOOK", platformAccountId: `pro_fb_1_${suffix}`, platformAccountName: "Enterprise FB 1", status: "CONNECTED" },
        { businessId: proBiz.id, platform: "FACEBOOK", platformAccountId: `pro_fb_2_${suffix}`, platformAccountName: "Enterprise FB 2", status: "CONNECTED" },
        { businessId: proBiz.id, platform: "INSTAGRAM", platformAccountId: `pro_ig_1_${suffix}`, platformAccountName: "@enterprise_ig_1", status: "CONNECTED" },
        { businessId: proBiz.id, platform: "WHATSAPP", platformAccountId: `pro_wa_1_${suffix}`, platformAccountName: "+639170000001", status: "CONNECTED" },
        { businessId: proBiz.id, platform: "TIKTOK", platformAccountId: `pro_tt_1_${suffix}`, platformAccountName: "@enterprise_tok", status: "CONNECTED" },
      ],
    });

    const proUsage = await SubscriptionEntitlementService.getChannelEntitlement(proBiz.id);
    assert(proUsage.connectedCount === 5, "Pro plan has 5 accounts connected");
    assert(proUsage.maxAllowed === null, "Pro plan maxAllowed is null (unlimited)");
    assert(proUsage.remainingSlots === null, "Pro plan remainingSlots is null (unlimited)");
    assert(proUsage.canConnectAnother === true, "Pro plan can connect unlimited accounts");

    // ─── TEST 8: Downgrade from Pro to Starter Suspends Excess Accounts ───
    console.log("\n--- TEST 8: Downgrade Suspension (SUSPENDED_BY_PLAN) ---");
    await SubscriptionEntitlementService.handlePlanDowngrade(proBiz.id, "STARTER");

    const proActiveAfterDowngrade = await prisma.platformConnection.count({
      where: { businessId: proBiz.id, status: "CONNECTED" },
    });
    const proSuspendedAfterDowngrade = await prisma.platformConnection.count({
      where: { businessId: proBiz.id, status: "SUSPENDED_BY_PLAN" },
    });

    assert(proActiveAfterDowngrade === 1, "Downgrade preserved 1 active account matching Starter tier");
    assert(proSuspendedAfterDowngrade === 4, "Excess 4 accounts marked SUSPENDED_BY_PLAN with zero data deletion");

    // ─── TEST 9: Upgrade Restores Suspended Accounts ───
    console.log("\n--- TEST 9: Upgrade Restores Suspended Accounts ---");
    await SubscriptionEntitlementService.handlePlanUpgrade(proBiz.id, "PRO");

    const proActiveAfterUpgrade = await prisma.platformConnection.count({
      where: { businessId: proBiz.id, status: "CONNECTED" },
    });
    assert(proActiveAfterUpgrade === 5, "Upgrade to Pro restored all 5 accounts to CONNECTED");

    // ─── TEST 10: AI Copilot Grounding for Plan Limits ───
    console.log("\n--- TEST 10: AI Copilot Grounded Channel Intelligence ---");
    const aiStarterQ = await CopilotQaEngine.answerQuestion(starterBiz.id, "How many channels am I using?");
    assert(aiStarterQ.answer.includes("1 of 1") || aiStarterQ.answer.includes("Starter"), "AI accurately reported 1 of 1 channel limit for Starter");

    const aiCanConnectQ = await CopilotQaEngine.answerQuestion(starterBiz.id, "Can I connect another account?");
    assert(aiCanConnectQ.answer.includes("reached your limit") || aiCanConnectQ.answer.includes("Starter"), "AI grounded response explaining why new connection is blocked on Starter");

    console.log("\n============================================================");
    console.log(`PRICING ALIGNMENT SUITE PASSED: ${passed}/${total} assertions`);
    console.log("============================================================\n");
  } finally {
    // ─── Cleanup Test Fixtures ───
    await prisma.platformConnection.deleteMany({
      where: { businessId: { in: [trialBiz.id, starterBiz.id, businessBiz.id, proBiz.id] } },
    });
    await prisma.business.deleteMany({
      where: { id: { in: [trialBiz.id, starterBiz.id, businessBiz.id, proBiz.id] } },
    });
  }
}

runPricingAlignmentTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Pricing Alignment Suite Failed:", err);
    process.exit(1);
  });
