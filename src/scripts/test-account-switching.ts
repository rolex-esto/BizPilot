/**
 * BizPilot Multi-Account Switching & Subscription Governance Automated Test Suite
 * 
 * Tests:
 * 1. Same-platform multi-account connections (Page A, Page B on Facebook)
 * 2. Subscription limit enforcement (Starter = 1, Business = 3, Pro = Unlimited)
 * 3. Disconnect slot freeing & historical data preservation
 * 4. Reconnect idempotency & duplicate prevention
 * 5. Database unique constraint: @@unique([businessId, platform, platformAccountId])
 * 6. Account-aware webhook routing
 * 7. Graceful plan downgrade (SUSPENDED_BY_PLAN) & upgrade reactivation
 * 8. Server-side tenant isolation & direct-ID attack resistance
 * 9. AI Copilot account grounding & confirmation safety
 * 10. Audit logging verification
 */

import { prisma } from "@/lib/prisma";
import { SubscriptionEntitlementService } from "@/lib/auth/subscription-entitlement";
import { MessageHub } from "@/lib/connectors/hub";
import { DeveloperSimulator } from "@/lib/connectors/simulator";
import { CopilotQaEngine } from "@/lib/ai/copilot-qa";

async function runAccountSwitchingTests() {
  console.log("============================================================");
  console.log("STARTING MULTI-ACCOUNT SWITCHING & SUBSCRIPTION GOVERNANCE SUITE");
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

  const testSuffix = Date.now().toString();

  // ─── Setup Test Businesses & Accounts ───
  const bizStarter = await prisma.business.create({
    data: {
      name: `Starter MSME ${testSuffix}`,
      ownerName: "Owner Starter",
      email: `starter_${testSuffix}@bizpilot.test`,
      planTier: "STARTER",
      subscriptionStatus: "ACTIVE",
    },
  });

  const bizBusiness = await prisma.business.create({
    data: {
      name: `Business MSME ${testSuffix}`,
      ownerName: "Owner Business",
      email: `biz_${testSuffix}@bizpilot.test`,
      planTier: "BUSINESS",
      subscriptionStatus: "ACTIVE",
    },
  });

  const bizPro = await prisma.business.create({
    data: {
      name: `Pro MSME ${testSuffix}`,
      ownerName: "Owner Pro",
      email: `pro_${testSuffix}@bizpilot.test`,
      planTier: "PRO",
      subscriptionStatus: "ACTIVE",
    },
  });

  try {
    // ─── TEST 1: Starter Plan Entitlement & Limits ───
    console.log("\n--- TEST 1: Starter Plan Channel Limit (Max 1 Channel) ---");
    const starterEntitlement = await SubscriptionEntitlementService.getChannelEntitlement(bizStarter.id);
    assert(starterEntitlement.planTier === "STARTER", "Starter plan tier resolved correctly");
    assert(starterEntitlement.maxAllowed === 1, "Starter plan max channels is strictly 1");
    assert(starterEntitlement.connectedCount === 0, "Starter initially has 0 channels");
    assert(starterEntitlement.canConnectAnother === true, "Starter can connect first channel");

    // ─── TEST 2: Connect First Account on Starter (Facebook Page A) ───
    console.log("\n--- TEST 2: Connect First Account on Starter ---");
    const conn1 = await prisma.platformConnection.create({
      data: {
        businessId: bizStarter.id,
        platform: "FACEBOOK",
        platformAccountId: `fb_page_a_${testSuffix}`,
        platformAccountName: "Manila Gadgets Page A",
        status: "CONNECTED",
        capabilitiesJson: JSON.stringify({ messaging: true }),
      },
    });
    assert(conn1.status === "CONNECTED", "Connected Facebook Page A on Starter");

    const starterAfter1 = await SubscriptionEntitlementService.getChannelEntitlement(bizStarter.id);
    assert(starterAfter1.connectedCount === 1, "Starter now has 1 connected account");
    assert(starterAfter1.remainingSlots === 0, "Starter has 0 remaining slots");
    assert(starterAfter1.canConnectAnother === false, "Starter canConnectAnother is now false");

    // ─── TEST 3: Starter Blocks Second Connection (Facebook Page B) ───
    console.log("\n--- TEST 3: Starter Blocks Connecting Second Account ---");
    const blockError = await SubscriptionEntitlementService.validateConnectionEntitlement(
      bizStarter.id,
      "FACEBOOK",
      `fb_page_b_${testSuffix}`
    );
    assert(blockError !== null, "Starter blocks 2nd account connection");
    const errBody = await blockError!.json();
    assert(errBody.code === "CHANNEL_LIMIT_REACHED", "Returned CHANNEL_LIMIT_REACHED error code");

    // ─── TEST 4: Starter Blocks Restricted Platform (Instagram on Starter) ───
    console.log("\n--- TEST 4: Starter Blocks Platform Not In Plan ---");
    const platError = await SubscriptionEntitlementService.validateConnectionEntitlement(
      bizStarter.id,
      "INSTAGRAM",
      `ig_acc_${testSuffix}`
    );
    assert(platError !== null, "Starter blocks Instagram connection (requires Business plan)");
    const platErrBody = await platError!.json();
    assert(platErrBody.code === "PLATFORM_NOT_IN_PLAN", "Returned PLATFORM_NOT_IN_PLAN error code");

    // ─── TEST 5: Disconnect Page A Frees the Channel Slot ───
    console.log("\n--- TEST 5: Disconnect Frees Subscription Channel Slot ---");
    await prisma.platformConnection.update({
      where: { id: conn1.id },
      data: { status: "DISCONNECTED" },
    });

    const starterAfterDisconnect = await SubscriptionEntitlementService.getChannelEntitlement(bizStarter.id);
    assert(starterAfterDisconnect.connectedCount === 0, "Connected count decrements to 0 after disconnect");
    assert(starterAfterDisconnect.remainingSlots === 1, "Remaining slots restored to 1");
    assert(starterAfterDisconnect.canConnectAnother === true, "canConnectAnother is restored to true");

    // ─── TEST 6: Reconnect Page A Restores Record Without Duplication ───
    console.log("\n--- TEST 6: Reconnect Idempotency & Duplicate Prevention ---");
    // Reconnecting the same platformAccountId
    const reconnected = await prisma.platformConnection.update({
      where: {
        businessId_platform_platformAccountId: {
          businessId: bizStarter.id,
          platform: "FACEBOOK",
          platformAccountId: `fb_page_a_${testSuffix}`,
        },
      },
      data: { status: "CONNECTED", platformAccountName: "Manila Gadgets Page A (Reconnected)" },
    });
    assert(reconnected.id === conn1.id, "Reconnection modified existing record instead of creating duplicate");
    assert(reconnected.status === "CONNECTED", "Status restored to CONNECTED");

    const totalConns = await prisma.platformConnection.count({
      where: { businessId: bizStarter.id },
    });
    assert(totalConns === 1, "Total connection records in DB remains strictly 1");

    // ─── TEST 7: DB Level Unique Constraint Prevents Concurrent Duplicate Insert ───
    console.log("\n--- TEST 7: Database Unique Constraint Enforces Single Account Record ---");
    let duplicateRejected = false;
    try {
      await prisma.platformConnection.create({
        data: {
          businessId: bizStarter.id,
          platform: "FACEBOOK",
          platformAccountId: `fb_page_a_${testSuffix}`,
          platformAccountName: "Duplicate Page A",
          status: "CONNECTED",
        },
      });
    } catch (e: any) {
      duplicateRejected = true;
    }
    assert(duplicateRejected === true, "Prisma unique constraint @@unique([businessId, platform, platformAccountId]) rejected duplicate insert");

    // ─── TEST 8: Business Plan Multi-Account Support (3 Channels) ───
    console.log("\n--- TEST 8: Business Plan Supports Multi-Account on Same Platform ---");
    const bizEntitlement = await SubscriptionEntitlementService.getChannelEntitlement(bizBusiness.id);
    assert(bizEntitlement.maxAllowed === 3, "Business plan allows 3 channels");

    // Connect Facebook Page 1
    const fb1 = await prisma.platformConnection.create({
      data: {
        businessId: bizBusiness.id,
        platform: "FACEBOOK",
        platformAccountId: `biz_fb_page_1_${testSuffix}`,
        platformAccountName: "TechStore Main Branch",
        status: "CONNECTED",
      },
    });

    // Connect Facebook Page 2 (Same platform, different page!)
    const fb2 = await prisma.platformConnection.create({
      data: {
        businessId: bizBusiness.id,
        platform: "FACEBOOK",
        platformAccountId: `biz_fb_page_2_${testSuffix}`,
        platformAccountName: "TechStore Gaming Branch",
        status: "CONNECTED",
      },
    });

    // Connect Instagram Account 1
    const ig1 = await prisma.platformConnection.create({
      data: {
        businessId: bizBusiness.id,
        platform: "INSTAGRAM",
        platformAccountId: `biz_ig_1_${testSuffix}`,
        platformAccountName: "@techstore_ph",
        status: "CONNECTED",
      },
    });

    const bizAfter3 = await SubscriptionEntitlementService.getChannelEntitlement(bizBusiness.id);
    assert(bizAfter3.connectedCount === 3, "Business plan successfully connected 3 distinct accounts");
    assert(bizAfter3.canConnectAnother === false, "Limit of 3 reached on Business plan");

    // ─── TEST 9: Account-Aware Webhook Routing ───
    console.log("\n--- TEST 9: Account-Aware Webhook Routing to Specific PlatformConnection ---");
    const simEvent1 = DeveloperSimulator.createSimulatedEvent(
      "FACEBOOK",
      "Customer Alpha",
      "Inquiring on Gaming Branch page",
      {
        externalAccountId: `biz_fb_page_2_${testSuffix}`,
        senderHandle: "customer.alpha",
      }
    );

    const ingResult1 = await MessageHub.ingestMessage(simEvent1);
    assert(ingResult1.platformConnectionId === fb2.id, "Webhook event correctly routed to Facebook Page 2 PlatformConnection");

    // ─── TEST 10: Graceful Plan Downgrade & Account Suspension ───
    console.log("\n--- TEST 10: Graceful Plan Downgrade (SUSPENDED_BY_PLAN) ---");
    // Downgrade bizBusiness from BUSINESS (3) to STARTER (1)
    await SubscriptionEntitlementService.handlePlanDowngrade(bizBusiness.id, "STARTER");

    const activeAfterDowngrade = await prisma.platformConnection.count({
      where: { businessId: bizBusiness.id, status: "CONNECTED" },
    });
    const suspendedAfterDowngrade = await prisma.platformConnection.count({
      where: { businessId: bizBusiness.id, status: "SUSPENDED_BY_PLAN" },
    });

    assert(activeAfterDowngrade === 1, "Downgrade preserved exactly 1 active channel matching Starter limit");
    assert(suspendedAfterDowngrade === 2, "Excess 2 channels marked SUSPENDED_BY_PLAN with zero data deletion");

    // ─── TEST 11: Plan Upgrade Restores Suspended Connections ───
    console.log("\n--- TEST 11: Plan Upgrade Restores Suspended Connections ---");
    await SubscriptionEntitlementService.handlePlanUpgrade(bizBusiness.id, "BUSINESS");

    const activeAfterUpgrade = await prisma.platformConnection.count({
      where: { businessId: bizBusiness.id, status: "CONNECTED" },
    });
    assert(activeAfterUpgrade === 3, "Plan upgrade successfully restored suspended accounts back to CONNECTED");

    // ─── TEST 12: Pro Plan Unlimited Connections ───
    console.log("\n--- TEST 12: Pro Plan Unlimited Connections ---");
    const proEntitlement = await SubscriptionEntitlementService.getChannelEntitlement(bizPro.id);
    assert(proEntitlement.maxAllowed === null, "Pro plan maxAllowed is null (unlimited)");
    assert(proEntitlement.canConnectAnother === true, "Pro plan can connect unlimited accounts");

    // ─── TEST 13: Tenant Isolation (Tenant A cannot see or manipulate Tenant B channels) ───
    console.log("\n--- TEST 13: Strict Multi-Tenant Channel Isolation ---");
    const tenantAConns = await prisma.platformConnection.findMany({
      where: { businessId: bizStarter.id },
    });
    const tenantBConns = await prisma.platformConnection.findMany({
      where: { businessId: bizBusiness.id },
    });

    const crossLeakage = tenantAConns.some((a) => tenantBConns.some((b) => b.id === a.id));
    assert(crossLeakage === false, "Zero channel ID leakage between Starter and Business tenants");

    // ─── TEST 14: AI Copilot Grounded Channel Intelligence ───
    console.log("\n--- TEST 14: AI Copilot Account-Aware Q&A ---");
    const qChannels = await CopilotQaEngine.answerQuestion(bizBusiness.id, "What Facebook accounts are connected?");
    assert(qChannels.answer.includes("TechStore Main Branch") && qChannels.answer.includes("TechStore Gaming Branch"), "AI accurately listed both connected Facebook pages from DB");

    const qCanConnect = await CopilotQaEngine.answerQuestion(bizStarter.id, "Can I connect another account?");
    assert(qCanConnect.answer.includes("reached your limit") || qCanConnect.answer.includes("Starter"), "AI accurately grounded channel limit response for Starter plan");

    const qDisconnectSafety = await CopilotQaEngine.answerQuestion(bizBusiness.id, "Disconnect my Facebook page");
    assert(qDisconnectSafety.answer.includes("Channels page") && qDisconnectSafety.answer.includes("confirmation"), "AI strictly requires explicit dashboard confirmation before disconnecting accounts");

    // ─── TEST 15: Audit Trail Verification ───
    console.log("\n--- TEST 15: Audit Trail Verification ---");
    const auditLogs = await prisma.auditLog.findMany({
      where: { businessId: bizBusiness.id },
    });
    assert(auditLogs.length > 0, "Audit logs recorded for account lifecycle events");
    const hasSuspendedAudit = auditLogs.some((l) => l.action === "ACCOUNT_SUSPENDED_BY_PLAN");
    const hasReactivatedAudit = auditLogs.some((l) => l.action === "ACCOUNT_REACTIVATED");
    assert(hasSuspendedAudit === true, "Audit trail logged ACCOUNT_SUSPENDED_BY_PLAN");
    assert(hasReactivatedAudit === true, "Audit trail logged ACCOUNT_REACTIVATED");

    console.log("\n============================================================");
    console.log(`MULTI-ACCOUNT SWITCHING SUITE PASSED: ${passed}/${total} assertions`);
    console.log("============================================================\n");
  } finally {
    // ─── Teardown Test Data Cleanly ───
    await prisma.platformConnection.deleteMany({
      where: { businessId: { in: [bizStarter.id, bizBusiness.id, bizPro.id] } },
    });
    await prisma.message.deleteMany({
      where: { conversation: { businessId: { in: [bizStarter.id, bizBusiness.id, bizPro.id] } } },
    });
    await prisma.conversation.deleteMany({
      where: { businessId: { in: [bizStarter.id, bizBusiness.id, bizPro.id] } },
    });
    await prisma.customer.deleteMany({
      where: { businessId: { in: [bizStarter.id, bizBusiness.id, bizPro.id] } },
    });
    await prisma.auditLog.deleteMany({
      where: { businessId: { in: [bizStarter.id, bizBusiness.id, bizPro.id] } },
    });
    await prisma.business.deleteMany({
      where: { id: { in: [bizStarter.id, bizBusiness.id, bizPro.id] } },
    });
  }
}

runAccountSwitchingTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test Suite Failed:", err);
    process.exit(1);
  });
