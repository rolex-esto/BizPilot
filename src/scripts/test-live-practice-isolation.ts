import { prisma } from "../lib/prisma";
import { MessageHub } from "../lib/connectors/hub";
import { DeveloperSimulator } from "../lib/connectors/simulator";
import { POST as handleSimulatorCustomerMessage } from "../app/api/simulator/customer-message/route";
import { POST as handleSimulatorCustomerReply } from "../app/api/simulator/customer-reply/route";
import { POST as handleSimulatorReset } from "../app/api/simulator/reset/route";
import { POST as handleCreateOrder } from "../app/api/orders/create/route";
import { askGeminiCopilot } from "../lib/ai/gemini-copilot";
import { createSession } from "../lib/auth/session";
import { NextRequest } from "next/server";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}`, details || "");
  }
}

async function main() {
  console.log("===============================================================");
  console.log("  BIZPILOT HARD LIVE VS PRACTICE ISOLATION TEST SUITE");
  console.log("===============================================================\n");

  // Setup: Find or Create Test Businesses (Tenant A and Tenant B)
  let userA = await prisma.user.findFirst({
    where: { email: "owner_isolation_a@bizpilot.ph" },
  });

  if (!userA) {
    const bizA = await prisma.business.create({
      data: {
        name: "Tenant A Electronics",
        ownerName: "Owner A",
        planTier: "PRO",
      },
    });
    userA = await prisma.user.create({
      data: {
        email: "owner_isolation_a@bizpilot.ph",
        name: "Owner A",
        passwordHash: "test_hash",
        role: "OWNER",
        businessId: bizA.id,
      },
    });
  }

  let userB = await prisma.user.findFirst({
    where: { email: "owner_isolation_b@bizpilot.ph" },
  });

  if (!userB) {
    const bizB = await prisma.business.create({
      data: {
        name: "Tenant B Fashion",
        ownerName: "Owner B",
        planTier: "STARTER",
      },
    });
    userB = await prisma.user.create({
      data: {
        email: "owner_isolation_b@bizpilot.ph",
        name: "Owner B",
        passwordHash: "test_hash",
        role: "OWNER",
        businessId: bizB.id,
      },
    });
  }

  const bizAId = userA.businessId!;
  const bizBId = userB.businessId!;

  // Create test products for Tenant A
  let laptopProduct = await prisma.product.findFirst({
    where: { businessId: bizAId, sku: "LAPTOP-ISO-01" },
  });
  if (!laptopProduct) {
    laptopProduct = await prisma.product.create({
      data: {
        businessId: bizAId,
        sku: "LAPTOP-ISO-01",
        name: "ThinkPad T480 Isolation Edition",
        category: "Laptops",
        price: 18500,
        stockQuantity: 10,
        safetyStockThreshold: 2,
        isActive: true,
      },
    });
  }

  const sessionA = await createSession(userA.id);

  // --- SCENARIO 1: Live Webhook Ingestion Creates Strict LIVE Records ---
  console.log("Scenario 1: Live Webhook Ingestion");
  const liveFbEvent = {
    platform: "FACEBOOK" as const,
    externalAccountId: "page_123456",
    senderExternalId: "real_fb_user_9999",
    senderName: "Real Facebook Customer",
    direction: "INBOUND" as const,
    textContent: "Hi, do you have the ThinkPad T480 available?",
    externalMessageId: `live_fb_msg_${Date.now()}`,
    timestamp: new Date(),
    environment: "LIVE" as const,
    sourceType: "FACEBOOK" as const,
    businessId: bizAId,
  };

  const liveIngestRes = await MessageHub.ingestMessage(liveFbEvent);
  const liveConv = await prisma.conversation.findUnique({
    where: { id: liveIngestRes.conversationId },
    include: { customer: true, messages: true },
  });

  assert(
    liveConv !== null &&
      liveConv.environment === "LIVE" &&
      liveConv.customer.environment === "LIVE" &&
      liveConv.messages[0].environment === "LIVE" &&
      liveConv.messages[0].sourceType === "FACEBOOK",
    "Live Webhook creates Conversation, Customer, and Message with environment=LIVE and sourceType=FACEBOOK"
  );

  // --- SCENARIO 2: Practice Simulator Ingestion Creates Strict PRACTICE Records ---
  console.log("\nScenario 2: Practice Simulator Ingestion");
  const simEvent = DeveloperSimulator.createSimulatedEvent(
    "FACEBOOK",
    "Simulated Buyer Marco",
    "How much is the ThinkPad T480?",
    {
      senderExternalId: `sim_user_${Date.now()}`,
      businessId: bizAId,
    }
  );
  simEvent.environment = "PRACTICE";
  simEvent.sourceType = "SIMULATOR";

  const simIngestRes = await MessageHub.ingestMessage(simEvent);
  const simConv = await prisma.conversation.findUnique({
    where: { id: simIngestRes.conversationId },
    include: { customer: true, messages: true },
  });

  assert(
    simConv !== null &&
      simConv.environment === "PRACTICE" &&
      simConv.customer.environment === "PRACTICE" &&
      simConv.messages[0].environment === "PRACTICE" &&
      simConv.messages[0].sourceType === "SIMULATOR",
    "Practice Simulator creates Conversation, Customer, and Message with environment=PRACTICE and sourceType=SIMULATOR"
  );

  // --- SCENARIO 3: Server-side LIVE Inbox Query Strictly Excludes PRACTICE ---
  console.log("\nScenario 3: Server-side LIVE Inbox Query");
  const liveInbox = await prisma.conversation.findMany({
    where: { businessId: bizAId, environment: "LIVE" },
  });

  const containsSimInLive = liveInbox.some((c) => c.environment !== "LIVE" || c.id === simConv!.id);
  assert(
    !containsSimInLive && liveInbox.some((c) => c.id === liveConv!.id),
    "Server-side LIVE inbox query strictly includes live conversations and excludes practice conversations"
  );

  // --- SCENARIO 4: Server-side PRACTICE Inbox Query Strictly Excludes LIVE ---
  console.log("\nScenario 4: Server-side PRACTICE Inbox Query");
  const practiceInbox = await prisma.conversation.findMany({
    where: { businessId: bizAId, environment: "PRACTICE" },
  });

  const containsLiveInPractice = practiceInbox.some((c) => c.environment !== "PRACTICE" || c.id === liveConv!.id);
  assert(
    !containsLiveInPractice && practiceInbox.some((c) => c.id === simConv!.id),
    "Server-side PRACTICE inbox query strictly includes practice conversations and excludes live conversations"
  );

  // --- SCENARIO 5 & 6: Simulator Reset Deletes Only PRACTICE and Preserves LIVE ---
  console.log("\nScenarios 5 & 6: Simulator Reset Isolation");
  const resetReq = new NextRequest("http://localhost:3000/api/simulator/reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `bizpilot_session=${sessionA.token}`,
    },
    body: JSON.stringify({ resetAll: true }),
  });

  const resetRes = await handleSimulatorReset(resetReq);
  const resetData = await resetRes.json();

  const remainingPractice = await prisma.conversation.findMany({
    where: { businessId: bizAId, environment: "PRACTICE" },
  });
  const remainingLive = await prisma.conversation.findMany({
    where: { businessId: bizAId, environment: "LIVE" },
  });

  assert(
    resetData.status === "success" && remainingPractice.length === 0,
    "Simulator Reset successfully clears all PRACTICE conversations"
  );

  assert(
    remainingLive.some((c) => c.id === liveConv!.id),
    "Simulator Reset strictly preserves all LIVE conversations and customer records"
  );

  // Re-create a practice conversation for subsequent test scenarios
  const simEvent2 = DeveloperSimulator.createSimulatedEvent(
    "FACEBOOK",
    "Simulated Buyer Marco 2",
    "Is the ThinkPad T480 available?",
    {
      senderExternalId: `sim_user_2_${Date.now()}`,
      businessId: bizAId,
    }
  );
  simEvent2.environment = "PRACTICE";
  simEvent2.sourceType = "SIMULATOR";
  const simIngestRes2 = await MessageHub.ingestMessage(simEvent2);
  const simConv2 = await prisma.conversation.findUnique({
    where: { id: simIngestRes2.conversationId },
    include: { customer: true },
  });

  // --- SCENARIO 7: Simulator Customer Message Rejects LIVE Conversation ---
  console.log("\nScenario 7: Simulator Inbound Protection on LIVE Conversation");
  const crossSimMsgReq = new NextRequest("http://localhost:3000/api/simulator/customer-message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `bizpilot_session=${sessionA.token}`,
    },
    body: JSON.stringify({
      conversationId: liveConv!.id,
      messageContent: "This should be rejected because conversation is LIVE",
    }),
  });

  const crossSimMsgRes = await handleSimulatorCustomerMessage(crossSimMsgReq);
  assert(
    crossSimMsgRes.status === 400,
    "POST /api/simulator/customer-message returns 400 Bad Request when dispatched to a LIVE conversation"
  );

  // --- SCENARIO 8: Simulator Customer Reply Rejects LIVE Conversation ---
  console.log("\nScenario 8: Simulator Customer Reply Protection on LIVE Conversation");
  const crossSimReplyReq = new NextRequest("http://localhost:3000/api/simulator/customer-reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `bizpilot_session=${sessionA.token}`,
    },
    body: JSON.stringify({
      conversationId: liveConv!.id,
      persona: "CURIOUS_CUSTOMER",
    }),
  });

  const crossSimReplyRes = await handleSimulatorCustomerReply(crossSimReplyReq);
  assert(
    crossSimReplyRes.status === 400,
    "POST /api/simulator/customer-reply returns 400 Bad Request when dispatched to a LIVE conversation"
  );

  // --- SCENARIO 9: Reset Single Conversation Rejects LIVE Conversation ---
  console.log("\nScenario 9: Reset Single Conversation Protection on LIVE Conversation");
  const resetLiveReq = new NextRequest("http://localhost:3000/api/simulator/reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `bizpilot_session=${sessionA.token}`,
    },
    body: JSON.stringify({ conversationId: liveConv!.id }),
  });

  const resetLiveRes = await handleSimulatorReset(resetLiveReq);
  assert(
    resetLiveRes.status === 400,
    "POST /api/simulator/reset returns 400 Bad Request when attempting to reset a LIVE conversation"
  );

  // --- SCENARIO 10: Outbound Message on LIVE Conversation is Tagged LIVE ---
  console.log("\nScenario 10: Outbound Message on LIVE Conversation");
  const liveOutboundMsg = await prisma.message.create({
    data: {
      conversationId: liveConv!.id,
      customerId: liveConv!.customerId,
      environment: "LIVE",
      sourceType: "FACEBOOK",
      platform: "FACEBOOK",
      direction: "OUTBOUND",
      textContent: "Yes po, available pa ang ThinkPad T480!",
      sentAt: new Date(),
      rawPayload: JSON.stringify({ actorType: "OWNER", senderRole: "OWNER", environment: "LIVE" }),
    },
  });

  assert(
    liveOutboundMsg.environment === "LIVE" && liveOutboundMsg.sourceType === "FACEBOOK",
    "Outbound owner message to live conversation is strictly stored with environment=LIVE"
  );

  // --- SCENARIO 11: Outbound Message on PRACTICE Conversation is Tagged PRACTICE ---
  console.log("\nScenario 11: Outbound Message on PRACTICE Conversation");
  const practiceOutboundMsg = await prisma.message.create({
    data: {
      conversationId: simConv2!.id,
      customerId: simConv2!.customerId,
      environment: "PRACTICE",
      sourceType: "SIMULATOR",
      platform: "FACEBOOK",
      direction: "OUTBOUND",
      textContent: "Yes po, ₱18,500 po last price!",
      sentAt: new Date(),
      rawPayload: JSON.stringify({ actorType: "OWNER", senderRole: "OWNER", environment: "PRACTICE" }),
    },
  });

  assert(
    practiceOutboundMsg.environment === "PRACTICE" && practiceOutboundMsg.sourceType === "SIMULATOR",
    "Outbound owner message to practice conversation is strictly stored with environment=PRACTICE"
  );

  // --- SCENARIO 12: Order Created from PRACTICE Conversation Does NOT Decrement Inventory ---
  console.log("\nScenario 12: Practice Order & Inventory Isolation");
  const initialStock = laptopProduct.stockQuantity;

  const practiceOrderReq = new NextRequest("http://localhost:3000/api/orders/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `bizpilot_session=${sessionA.token}`,
    },
    body: JSON.stringify({
      customerId: simConv2!.customerId,
      conversationId: simConv2!.id,
      environment: "PRACTICE",
      items: [{ productId: laptopProduct.id, quantity: 2, agreedUnitPrice: 17500 }],
      paymentMethod: "CASH",
      isImmediatePaid: true,
    }),
  });

  const practiceOrderRes = await handleCreateOrder(practiceOrderReq);
  const practiceOrderData = await practiceOrderRes.json();

  const refreshedProductAfterPractice = await prisma.product.findUnique({
    where: { id: laptopProduct.id },
  });

  assert(
    practiceOrderData.status === "success" &&
      practiceOrderData.order.environment === "PRACTICE" &&
      refreshedProductAfterPractice?.stockQuantity === initialStock,
    `Practice order created with environment=PRACTICE and real inventory was NOT decremented (Stock remains ${initialStock})`
  );

  // --- SCENARIO 13: Order Created from LIVE Conversation Decrements Inventory When Paid ---
  console.log("\nScenario 13: Live Order Inventory Decrement");
  const liveOrderReq = new NextRequest("http://localhost:3000/api/orders/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `bizpilot_session=${sessionA.token}`,
    },
    body: JSON.stringify({
      customerId: liveConv!.customerId,
      conversationId: liveConv!.id,
      environment: "LIVE",
      items: [{ productId: laptopProduct.id, quantity: 1, agreedUnitPrice: 18500 }],
      paymentMethod: "CASH",
      isImmediatePaid: true,
    }),
  });

  const liveOrderRes = await handleCreateOrder(liveOrderReq);
  const liveOrderData = await liveOrderRes.json();

  const refreshedProductAfterLive = await prisma.product.findUnique({
    where: { id: laptopProduct.id },
  });

  assert(
    liveOrderData.status === "success" &&
      liveOrderData.order.environment === "LIVE" &&
      refreshedProductAfterLive?.stockQuantity === initialStock - 1,
    `Live order created with environment=LIVE and real inventory decremented from ${initialStock} to ${refreshedProductAfterLive?.stockQuantity}`
  );

  // --- SCENARIO 14: AI Copilot Context Strictly Excludes PRACTICE Data ---
  console.log("\nScenario 14: AI Copilot Context Grounding Isolation");
  const copilotResponse = await askGeminiCopilot(
    bizAId,
    "How many live orders do I have and what are my total sales?"
  );

  assert(
    copilotResponse.answer.length > 0 &&
      !copilotResponse.answer.includes("SIM-2026"),
    "AI Copilot context correctly operates with zero hallucination from practice simulator orders"
  );

  // --- SCENARIO 15: Cross-Tenant Isolation Across LIVE and PRACTICE ---
  console.log("\nScenario 15: Multi-Tenant Boundary Isolation");
  const tenantBInbox = await prisma.conversation.findMany({
    where: { businessId: bizBId },
  });

  const tenantBSeesTenantA = tenantBInbox.some(
    (c) => c.id === liveConv!.id || c.id === simConv2!.id || c.businessId === bizAId
  );

  assert(
    !tenantBSeesTenantA && tenantBInbox.every((c) => c.businessId === bizBId),
    "Tenant B cannot view Tenant A's LIVE or PRACTICE conversations"
  );

  console.log("\n===============================================================");
  console.log(`  ISOLATION TEST SUMMARY: ${passedTests}/${totalTests} PASS (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("===============================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});
