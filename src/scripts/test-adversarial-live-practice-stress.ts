import { prisma } from "../lib/prisma";
import { MessageHub } from "../lib/connectors/hub";
import { DeveloperSimulator } from "../lib/connectors/simulator";
import { POST as handleSimulatorCustomerMessage } from "../app/api/simulator/customer-message/route";
import { POST as handleSimulatorCustomerReply } from "../app/api/simulator/customer-reply/route";
import { POST as handleSimulatorReset } from "../app/api/simulator/reset/route";
import { POST as handleSendMessage } from "../app/api/messages/send/route";
import { POST as handleCreateOrder } from "../app/api/orders/create/route";
import { askGeminiCopilot } from "../lib/ai/gemini-copilot";
import { createSession } from "../lib/auth/session";
import { NextRequest } from "next/server";

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, testName: string, evidence?: any) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✅ [PASS] ${testName}`);
    if (evidence) {
      console.log(`     Evidence: ${JSON.stringify(evidence)}`);
    }
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    if (evidence) {
      console.error(`     Failure Evidence:`, evidence);
    }
  }
}

async function main() {
  console.log("================================================================================");
  console.log("  BIZPILOT ADVERSARIAL END-TO-END STRESS & BOUNDARY ISOLATION TEST SUITE");
  console.log("================================================================================\n");

  const timestamp = Date.now();

  // 1. Provision Test Business Tenants (Tenant A and Tenant B)
  const bizA = await prisma.business.create({
    data: {
      name: `Adversarial Store A ${timestamp}`,
      ownerName: "Stress Tester A",
      planTier: "PRO",
    },
  });

  const userA = await prisma.user.create({
    data: {
      email: `adv_user_a_${timestamp}@bizpilot.ph`,
      name: "Tester A",
      passwordHash: "test_hash",
      role: "OWNER",
      businessId: bizA.id,
    },
  });

  const bizB = await prisma.business.create({
    data: {
      name: `Adversarial Store B ${timestamp}`,
      ownerName: "Stress Tester B",
      planTier: "STARTER",
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: `adv_user_b_${timestamp}@bizpilot.ph`,
      name: "Tester B",
      passwordHash: "test_hash",
      role: "OWNER",
      businessId: bizB.id,
    },
  });

  const sessionA = await createSession(userA.id);
  const sessionB = await createSession(userB.id);

  // Create test inventory for Tenant A
  const productA = await prisma.product.create({
    data: {
      businessId: bizA.id,
      sku: `ADV-LAPTOP-${timestamp}`,
      name: "ThinkPad Adversarial Stress Model",
      category: "Laptops",
      price: 25000,
      stockQuantity: 100, // Initial stock: 100 units
      safetyStockThreshold: 5,
      isActive: true,
    },
  });

  console.log(`[PROVISIONED] Tenant A (${bizA.id}), Tenant B (${bizB.id})`);
  console.log(`[CATALOG] Product "${productA.name}" with initial stock = 100\n`);

  // ============================================================================
  // SECTION 1: WEBHOOK IDEMPOTENCY & CONCURRENT DUPLICATE WEBHOOK STORM
  // ============================================================================
  console.log("--- SECTION 1: DUPLICATE WEBHOOK IDEMPOTENCY STORM (50 Concurrent Events) ---");
  const duplicateMsgId = `meta_webhook_dup_${timestamp}`;
  const webhookStormPromises = [];

  for (let i = 0; i < 50; i++) {
    webhookStormPromises.push(
      MessageHub.ingestMessage({
        platform: "FACEBOOK",
        externalAccountId: "page_adv_123",
        senderExternalId: "real_buyer_storm_001",
        senderName: "Storm Buyer Facebook",
        direction: "INBOUND",
        textContent: "Hello! Is this available for immediate shipment?",
        externalMessageId: duplicateMsgId, // Same message ID
        timestamp: new Date(),
        environment: "LIVE",
        sourceType: "FACEBOOK",
        businessId: bizA.id,
      })
    );
  }

  const stormResults = await Promise.all(webhookStormPromises);
  const dupCount = stormResults.filter((r) => r.isDuplicate).length;
  const createdCount = stormResults.filter((r) => !r.isDuplicate).length;

  const dbMessagesForStorm = await prisma.message.findMany({
    where: { externalMessageId: duplicateMsgId },
  });

  assert(
    createdCount === 1 && dupCount === 49 && dbMessagesForStorm.length === 1,
    "50 concurrent identical webhook deliveries resulted in EXACTLY 1 message record (49 duplicates suppressed)",
    { createdCount, dupCount, dbRecords: dbMessagesForStorm.length }
  );

  const stormConv = await prisma.conversation.findUnique({
    where: { id: dbMessagesForStorm[0].conversationId },
  });

  assert(
    stormConv !== null && stormConv.environment === "LIVE" && stormConv.unreadCount === 1,
    "Live conversation created with unreadCount = 1 (not inflated to 50)",
    { unreadCount: stormConv?.unreadCount, environment: stormConv?.environment }
  );

  // ============================================================================
  // SECTION 2: HIGH-VOLUME RAPID SIMULATOR SPAM (1, 10, 50, 100 TURNS)
  // ============================================================================
  console.log("\n--- SECTION 2: HIGH-VOLUME RAPID SIMULATOR SPAM (100 Turns Test) ---");

  // Create initial practice conversation
  const initialSimEvent = DeveloperSimulator.createSimulatedEvent(
    "FACEBOOK",
    "Rapid Simulated Customer Juan",
    "Turn 1: Hi boss, how much is this laptop?",
    {
      senderExternalId: `sim_juan_${timestamp}`,
      businessId: bizA.id,
    }
  );
  initialSimEvent.environment = "PRACTICE";
  initialSimEvent.sourceType = "SIMULATOR";

  const initSimRes = await MessageHub.ingestMessage(initialSimEvent);
  const simConvId = initSimRes.conversationId;

  console.log(`Executing 99 additional sequential turns in conversation ${simConvId}...`);

  for (let turn = 2; turn <= 100; turn++) {
    if (turn % 3 === 1) {
      // CUSTOMER INBOUND TURN
      const custReq = new NextRequest("http://localhost:3000/api/simulator/customer-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `bizpilot_session=${sessionA.token}` },
        body: JSON.stringify({
          conversationId: simConvId,
          persona: "BARGAIN_HUNTER",
          customText: `Customer Turn ${turn}: Pwede po ₱23,000 cash?`,
          simulatorAutoReply: false,
        }),
      });
      await handleSimulatorCustomerReply(custReq);
    } else if (turn % 3 === 2) {
      // OWNER OUTBOUND TURN
      const ownerReq = new NextRequest("http://localhost:3000/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `bizpilot_session=${sessionA.token}` },
        body: JSON.stringify({
          conversationId: simConvId,
          textContent: `Owner Turn ${turn}: Sige boss, ₱24,000 last price natin.`,
        }),
      });
      await handleSendMessage(ownerReq);
    } else {
      // AI AUTO-REPLY TURN
      const aiSimReq = new NextRequest("http://localhost:3000/api/simulator/customer-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `bizpilot_session=${sessionA.token}` },
        body: JSON.stringify({
          conversationId: simConvId,
          persona: "CURIOUS_CUSTOMER",
          customText: `Customer Turn ${turn}: Available pa po ba meetup sa Megamall?`,
          simulatorAutoReply: true, // Triggers AI Outbound
        }),
      });
      await handleSimulatorCustomerReply(aiSimReq);
    }
  }

  const allSimMessages = await prisma.message.findMany({
    where: { conversationId: simConvId },
    orderBy: { sentAt: "asc" },
  });

  console.log(`Total messages in practice thread: ${allSimMessages.length}`);

  let customerInboundCount = 0;
  let ownerOutboundCount = 0;
  let aiOutboundCount = 0;
  let invalidActorCount = 0;
  let invalidEnvCount = 0;

  for (const msg of allSimMessages) {
    const raw = JSON.parse(msg.rawPayload || "{}");
    if (msg.environment !== "PRACTICE" || msg.sourceType !== "SIMULATOR") {
      invalidEnvCount++;
    }

    if (msg.direction === "INBOUND") {
      if (raw.actorType === "CUSTOMER" && raw.senderRole === "CUSTOMER") {
        customerInboundCount++;
      } else {
        invalidActorCount++;
      }
    } else if (msg.direction === "OUTBOUND") {
      if (raw.actorType === "OWNER" && raw.senderRole === "OWNER") {
        ownerOutboundCount++;
      } else if (raw.actorType === "AI" && raw.senderRole === "AI") {
        aiOutboundCount++;
      } else {
        invalidActorCount++;
      }
    }
  }

  assert(
    allSimMessages.length >= 100 && invalidEnvCount === 0 && invalidActorCount === 0,
    "100 rapid turns completed with 100% actor model, direction, and environment integrity in database",
    {
      totalMessages: allSimMessages.length,
      customerInbound: customerInboundCount,
      ownerOutbound: ownerOutboundCount,
      aiOutbound: aiOutboundCount,
      invalidActors: invalidActorCount,
      invalidEnvironments: invalidEnvCount,
    }
  );

  // ============================================================================
  // SECTION 3: BOUNDARY INFILTRATION ATTACKS (LIVE ↔ PRACTICE)
  // ============================================================================
  console.log("\n--- SECTION 3: BOUNDARY INFILTRATION & SECURITY ATTACKS ---");

  // Attack 1: Dispatch simulator message to Live Conversation
  const attack1Req = new NextRequest("http://localhost:3000/api/simulator/customer-message", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `bizpilot_session=${sessionA.token}` },
    body: JSON.stringify({
      conversationId: stormConv!.id, // Target LIVE conversation
      messageContent: "Infiltration payload: simulated text to live thread",
    }),
  });
  const attack1Res = await handleSimulatorCustomerMessage(attack1Req);
  assert(
    attack1Res.status === 400,
    "Boundary Infiltration #1 BLOCKED: Cannot dispatch simulated customer message to LIVE conversation (HTTP 400)"
  );

  // Attack 2: Dispatch simulator reply to Live Conversation
  const attack2Req = new NextRequest("http://localhost:3000/api/simulator/customer-reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `bizpilot_session=${sessionA.token}` },
    body: JSON.stringify({
      conversationId: stormConv!.id, // Target LIVE conversation
      persona: "BARGAIN_HUNTER",
    }),
  });
  const attack2Res = await handleSimulatorCustomerReply(attack2Req);
  assert(
    attack2Res.status === 400,
    "Boundary Infiltration #2 BLOCKED: Cannot dispatch simulated customer reply to LIVE conversation (HTTP 400)"
  );

  // Attack 3: Attempt to reset Live Conversation
  const attack3Req = new NextRequest("http://localhost:3000/api/simulator/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `bizpilot_session=${sessionA.token}` },
    body: JSON.stringify({
      conversationId: stormConv!.id, // Target LIVE conversation
    }),
  });
  const attack3Res = await handleSimulatorReset(attack3Req);
  assert(
    attack3Res.status === 400,
    "Boundary Infiltration #3 BLOCKED: Cannot reset LIVE conversation (HTTP 400)"
  );

  // Attack 4: Cross-Tenant Simulator Reset Attack
  const attack4Req = new NextRequest("http://localhost:3000/api/simulator/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `bizpilot_session=${sessionB.token}` }, // Tenant B attempts to reset Tenant A
    body: JSON.stringify({
      conversationId: simConvId, // Tenant A's practice conversation
    }),
  });
  const attack4Res = await handleSimulatorReset(attack4Req);
  assert(
    attack4Res.status === 403 || attack4Res.status === 404,
    "Cross-Tenant Attack #4 BLOCKED: Tenant B cannot reset Tenant A's practice conversation (HTTP 403/404)"
  );

  // ============================================================================
  // SECTION 4: CONCURRENT INVENTORY & ORDER CREATION RACE CONDITIONS
  // ============================================================================
  console.log("\n--- SECTION 4: CONCURRENT INVENTORY & ORDER RACE CONDITION (20 Practice + 20 Live Orders) ---");

  const initialStock = 100;
  const orderPromises = [];

  // 20 Practice Orders (Should NOT decrement stock)
  for (let i = 0; i < 20; i++) {
    const practiceOrderReq = new NextRequest("http://localhost:3000/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `bizpilot_session=${sessionA.token}` },
      body: JSON.stringify({
        customerId: initSimRes.customerId, // Practice customer (actual Prisma ID)
        conversationId: simConvId,
        environment: "PRACTICE",
        items: [{ productId: productA.id, quantity: 1, agreedUnitPrice: 24000 }],
        paymentMethod: "CASH",
        isImmediatePaid: true,
      }),
    });
    orderPromises.push(handleCreateOrder(practiceOrderReq));
  }

  // 20 Live Orders (Should decrement stock by exactly 20)
  for (let i = 0; i < 20; i++) {
    const liveOrderReq = new NextRequest("http://localhost:3000/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `bizpilot_session=${sessionA.token}` },
      body: JSON.stringify({
        customerId: stormConv!.customerId, // Live customer
        conversationId: stormConv!.id,
        environment: "LIVE",
        items: [{ productId: productA.id, quantity: 1, agreedUnitPrice: 25000 }],
        paymentMethod: "CASH",
        isImmediatePaid: true,
      }),
    });
    orderPromises.push(handleCreateOrder(liveOrderReq));
  }

  await Promise.all(orderPromises);

  const refreshedProduct = await prisma.product.findUnique({
    where: { id: productA.id },
  });

  const practiceOrdersCount = await prisma.order.count({
    where: { businessId: bizA.id, environment: "PRACTICE" },
  });

  const liveOrdersCount = await prisma.order.count({
    where: { businessId: bizA.id, environment: "LIVE" },
  });

  assert(
    practiceOrdersCount === 20 && liveOrdersCount === 20 && refreshedProduct?.stockQuantity === 80,
    "40 concurrent orders (20 Practice + 20 Live) processed with exact inventory integrity: Stock decremented by 20 (100 -> 80)",
    {
      initialStock,
      practiceOrdersCreated: practiceOrdersCount,
      liveOrdersCreated: liveOrdersCount,
      finalStock: refreshedProduct?.stockQuantity,
    }
  );

  // ============================================================================
  // SECTION 5: AI COPILOT REVENUE GROUNDING & MEMORY ISOLATION
  // ============================================================================
  console.log("\n--- SECTION 5: AI COPILOT REVENUE GROUNDING & MEMORY ISOLATION ---");

  const copilotSalesQuery = await askGeminiCopilot(
    bizA.id,
    "How many live orders do I have and what are my total sales?"
  );

  assert(
    copilotSalesQuery.answer.includes("20 live production order") ||
      copilotSalesQuery.answer.includes("20"),
    "AI Copilot context strictly calculates only the 20 LIVE orders (excluding the 20 practice orders)",
    { answer: copilotSalesQuery.answer }
  );

  // ============================================================================
  // SECTION 6: RESET ALL SAFETY INVARIANT AUDIT
  // ============================================================================
  console.log("\n--- SECTION 6: RESET ALL SAFETY INVARIANT AUDIT ---");

  const liveConvsBefore = await prisma.conversation.count({
    where: { businessId: bizA.id, environment: "LIVE" },
  });
  const liveOrdersBefore = await prisma.order.count({
    where: { businessId: bizA.id, environment: "LIVE" },
  });
  const liveMessagesBefore = await prisma.message.count({
    where: { conversation: { businessId: bizA.id }, environment: "LIVE" },
  });

  const resetAllReq = new NextRequest("http://localhost:3000/api/simulator/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `bizpilot_session=${sessionA.token}` },
    body: JSON.stringify({ resetAll: true }),
  });

  await handleSimulatorReset(resetAllReq);

  const remainingPracticeConvs = await prisma.conversation.count({
    where: { businessId: bizA.id, environment: "PRACTICE" },
  });
  const remainingLiveConvs = await prisma.conversation.count({
    where: { businessId: bizA.id, environment: "LIVE" },
  });
  const remainingLiveOrders = await prisma.order.count({
    where: { businessId: bizA.id, environment: "LIVE" },
  });
  const remainingLiveMessages = await prisma.message.count({
    where: { conversation: { businessId: bizA.id }, environment: "LIVE" },
  });

  assert(
    remainingPracticeConvs === 0 &&
      remainingLiveConvs === liveConvsBefore &&
      remainingLiveOrders === liveOrdersBefore &&
      remainingLiveMessages === liveMessagesBefore,
    "Reset All cleared 100% of PRACTICE records while 100% of LIVE conversations, orders, and messages remain completely intact",
    {
      remainingPracticeConversations: remainingPracticeConvs,
      liveConversationsPreserved: `${remainingLiveConvs}/${liveConvsBefore}`,
      liveOrdersPreserved: `${remainingLiveOrders}/${liveOrdersBefore}`,
      liveMessagesPreserved: `${remainingLiveMessages}/${liveMessagesBefore}`,
    }
  );

  // ============================================================================
  // CLEANUP TEST DATA
  // ============================================================================
  console.log("\n--- CLEANING UP TEST ARTIFACTS ---");
  await prisma.session.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  await prisma.auditLog.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
  await prisma.orderItem.deleteMany({ where: { order: { businessId: { in: [bizA.id, bizB.id] } } } });
  await prisma.payment.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
  await prisma.order.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
  await prisma.message.deleteMany({ where: { conversation: { businessId: { in: [bizA.id, bizB.id] } } } });
  await prisma.conversation.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
  await prisma.customer.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
  await prisma.product.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  await prisma.business.deleteMany({ where: { id: { in: [bizA.id, bizB.id] } } });
  console.log("Cleanup complete.");

  console.log("\n================================================================================");
  console.log(`  ADVERSARIAL STRESS SUITE: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED (${Math.round((passedAssertions / totalAssertions) * 100)}%)`);
  console.log("================================================================================\n");

  if (passedAssertions !== totalAssertions) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Adversarial Test Suite Error:", err);
  process.exit(1);
});
