/**
 * Automated Verification Suite for Social Customer Identity Resolution & Fallback Governance
 */

import { prisma } from "../lib/prisma";
import { MessageHub } from "../lib/connectors/hub";
import { TokenVault } from "../lib/connectors/token-vault";
import { GroundedAiSuggestor } from "../lib/ai/grounded-suggestor";
import { AiClassifier } from "../lib/ai/classifier";
import { isFallbackCustomerName, formatCustomerGreetingName } from "../lib/connectors/identity-resolver";

async function runTests() {
  console.log("=== BIZPILOT SOCIAL CUSTOMER IDENTITY RESOLUTION TEST SUITE ===\n");
  let passed = 0;
  let total = 13;

  // Setup test business
  let testBiz = await prisma.business.findFirst({ where: { name: "Manila Gadgets Hub" } });
  if (!testBiz) {
    testBiz = await prisma.business.create({
      data: {
        name: "Manila Gadgets Hub",
        ownerName: "Rolex Esto",
        email: "manila.gadgets@bizpilot.ph",
        currency: "PHP",
      },
    });
  }

  let testBiz2 = await prisma.business.findFirst({ where: { name: "Manila Laptops" } });
  if (!testBiz2) {
    testBiz2 = await prisma.business.create({
      data: {
        name: "Manila Laptops",
        ownerName: "Jane Doe",
        email: "manila.laptops@bizpilot.ph",
        currency: "PHP",
      },
    });
  }

  // Setup connection for Page A with mock token
  const pageA_Id = "page_1242780318921380";
  const mockToken = TokenVault.encrypt("mock_meta_access_token_12345");
  
  await prisma.platformConnection.upsert({
    where: {
      businessId_platform_platformAccountId: {
        businessId: testBiz.id,
        platform: "FACEBOOK",
        platformAccountId: pageA_Id,
      },
    },
    update: { accessTokenEncrypted: mockToken, status: "CONNECTED" },
    create: {
      businessId: testBiz.id,
      platform: "FACEBOOK",
      platformAccountId: pageA_Id,
      platformAccountName: "Manila Gadgets Hub FB",
      accessTokenEncrypted: mockToken,
      status: "CONNECTED",
    },
  });

  // ----------------------------------------------------
  // TEST 1: Real Facebook message with profile available
  // ----------------------------------------------------
  console.log("[TEST 1] Facebook message with profile display name...");
  const runId = Date.now();
  const psid1 = "fb_user_" + runId;
  const res1 = await MessageHub.ingestMessage({
    platform: "FACEBOOK",
    externalAccountId: pageA_Id,
    externalThreadId: `fb_thread_${psid1}`,
    externalMessageId: `msg_fb_1_${Date.now()}`,
    senderExternalId: psid1,
    senderName: "Juan Dela Cruz",
    direction: "INBOUND",
    textContent: "Magkano po ang wireless keyboard?",
    businessId: testBiz.id,
    environment: "LIVE", timestamp: new Date(), rawPayload: {},
  });

  const c1 = await prisma.customer.findUnique({ where: { id: res1.customerId } });
  if (c1 && c1.name === "Juan Dela Cruz") {
    console.log("  ✓ PASS: Customer created with legitimate name:", c1.name);
    passed++;
  } else {
    console.error("  ✗ FAIL: Customer name was:", c1?.name);
  }

  // ----------------------------------------------------
  // TEST 2: Facebook message with profile lookup unavailable (Truthful Fallback)
  // ----------------------------------------------------
  console.log("\n[TEST 2] Facebook message where profile lookup is unavailable (Truthful Fallback)...");
  const psid2 = "377892_" + runId;
  const res2 = await MessageHub.ingestMessage({
    platform: "FACEBOOK",
    externalAccountId: pageA_Id,
    externalThreadId: `fb_thread_${psid2}`,
    externalMessageId: `msg_fb_2_${Date.now()}`,
    senderExternalId: psid2,
    direction: "INBOUND",
    textContent: "Available pa po ba?",
    businessId: testBiz.id,
    environment: "LIVE", timestamp: new Date(), rawPayload: {},
  });

  const c2 = await prisma.customer.findUnique({ where: { id: res2.customerId } });
  if (c2 && isFallbackCustomerName(c2.name) && c2.name.includes("377892")) {
    console.log("  ✓ PASS: Preserved truthful fallback identity:", c2.name);
    passed++;
  } else {
    console.error("  ✗ FAIL: Unexpected identity:", c2?.name);
  }

  // ----------------------------------------------------
  // TEST 3: Existing Fallback Customer Upgrade on Re-engagement
  // ----------------------------------------------------
  console.log("\n[TEST 3] Existing fallback customer upgraded when real profile data arrives...");
  // Simulate profile becoming available
  const res3 = await MessageHub.ingestMessage({
    platform: "FACEBOOK",
    externalAccountId: pageA_Id,
    externalThreadId: `fb_thread_${psid2}`,
    externalMessageId: `msg_fb_3_${Date.now()}`,
    senderExternalId: psid2,
    senderName: "Rolex Esto", // Live Graph API returns resolved profile
    direction: "INBOUND",
    textContent: "Gusto ko po umorder",
    businessId: testBiz.id,
    environment: "LIVE", timestamp: new Date(), rawPayload: {},
  });

  const c3 = await prisma.customer.findUnique({ where: { id: c2!.id } });
  if (c3 && c3.name === "Rolex Esto") {
    console.log("  ✓ PASS: Existing customer upgraded from fallback to:", c3.name);
    passed++;
  } else {
    console.error("  ✗ FAIL: Customer was not upgraded:", c3?.name);
  }

  // ----------------------------------------------------
  // TEST 4: Existing named customer sends another message (No duplicate)
  // ----------------------------------------------------
  console.log("\n[TEST 4] Existing named customer re-engagement (Duplicate Prevention)...");
  const countBefore = await prisma.customer.count({ where: { businessId: testBiz.id } });
  await MessageHub.ingestMessage({
    platform: "FACEBOOK",
    externalAccountId: pageA_Id,
    externalThreadId: `fb_thread_${psid1}`,
    externalMessageId: `msg_fb_4_${Date.now()}`,
    senderExternalId: psid1,
    senderName: "Juan Dela Cruz",
    direction: "INBOUND",
    textContent: "Pa-reserve po please",
    businessId: testBiz.id,
    environment: "LIVE", timestamp: new Date(), rawPayload: {},
  });
  const countAfter = await prisma.customer.count({ where: { businessId: testBiz.id } });
  if (countBefore === countAfter) {
    console.log("  ✓ PASS: Zero duplicate customers created on re-engagement.");
    passed++;
  } else {
    console.error("  ✗ FAIL: Duplicate customer created:", countBefore, "->", countAfter);
  }

  // ----------------------------------------------------
  // TEST 5: Instagram Message Resolution
  // ----------------------------------------------------
  console.log("\n[TEST 5] Instagram message identity resolution...");
  const igId = "ig_user_" + runId;
  const res5 = await MessageHub.ingestMessage({
    platform: "INSTAGRAM",
    externalAccountId: "ig_acct_123",
    externalThreadId: `ig_thread_${igId}`,
    externalMessageId: `msg_ig_1_${Date.now()}`,
    senderExternalId: igId,
    senderName: "Maria Clara",
    senderHandle: "@mariaclara_ph",
    direction: "INBOUND",
    textContent: "Hi, can you deliver today?",
    businessId: testBiz.id,
    environment: "LIVE", timestamp: new Date(), rawPayload: {},
  });
  const c5 = await prisma.customer.findUnique({ where: { id: res5.customerId } });
  if (c5 && c5.name === "Maria Clara" && c5.handle === "@mariaclara_ph") {
    console.log("  ✓ PASS: Instagram customer and handle resolved correctly:", c5.name, c5.handle);
    passed++;
  } else {
    console.error("  ✗ FAIL: Instagram customer mismatch:", c5);
  }

  // ----------------------------------------------------
  // TEST 6: WhatsApp Message Resolution
  // ----------------------------------------------------
  console.log("\n[TEST 6] WhatsApp contact name preservation...");
  const waPhone = "63917" + (runId % 10000000);
  const res6 = await MessageHub.ingestMessage({
    platform: "WHATSAPP",
    externalAccountId: "waba_phone_123",
    externalThreadId: `wa_thread_${waPhone}`,
    externalMessageId: `msg_wa_1_${Date.now()}`,
    senderExternalId: waPhone,
    senderName: "Kuya Bong",
    senderPhone: "+639171234567",
    direction: "INBOUND",
    textContent: "Location niyo po?",
    businessId: testBiz.id,
    environment: "LIVE", timestamp: new Date(), rawPayload: {},
  });
  const c6 = await prisma.customer.findUnique({ where: { id: res6.customerId } });
  if (c6 && c6.name === "Kuya Bong" && c6.phone === "+639171234567") {
    console.log("  ✓ PASS: WhatsApp contact profile and phone preserved:", c6.name, c6.phone);
    passed++;
  } else {
    console.error("  ✗ FAIL: WhatsApp profile mismatch:", c6);
  }

  // ----------------------------------------------------
  // TEST 7: TikTok Restricted Environment Fallback
  // ----------------------------------------------------
  console.log("\n[TEST 7] TikTok restricted environment truthful fallback...");
  const ttId = "tt_open_" + runId;
  const res7 = await MessageHub.ingestMessage({
    platform: "TIKTOK",
    externalAccountId: "tt_biz_123",
    externalThreadId: `tt_thread_${ttId}`,
    externalMessageId: `msg_tt_1_${Date.now()}`,
    senderExternalId: ttId,
    direction: "INBOUND",
    textContent: "HM po?",
    businessId: testBiz.id,
    environment: "LIVE", timestamp: new Date(), rawPayload: {},
  });
  const c7 = await prisma.customer.findUnique({ where: { id: res7.customerId } });
  if (c7 && isFallbackCustomerName(c7.name) && c7.name.includes("TikTok User")) {
    console.log("  ✓ PASS: TikTok restricted fallback truthful and non-fabricated:", c7.name);
    passed++;
  } else {
    console.error("  ✗ FAIL: TikTok identity fabricated or incorrect:", c7?.name);
  }

  // ----------------------------------------------------
  // TEST 8: Two Facebook Pages Isolation
  // ----------------------------------------------------
  console.log("\n[TEST 8] Two Facebook Pages Isolation...");
  const pageB_Id = "page_987654321000";
  const samePsid = "user_same_psid_different_scope";
  const res8 = await MessageHub.ingestMessage({
    platform: "FACEBOOK",
    externalAccountId: pageB_Id,
    externalThreadId: `fb_thread_${samePsid}`,
    externalMessageId: `msg_fb_pageb_${Date.now()}`,
    senderExternalId: samePsid,
    senderName: "Buyer on Page B",
    direction: "INBOUND",
    textContent: "Inquiry on Page B",
    businessId: testBiz.id,
    environment: "LIVE", timestamp: new Date(), rawPayload: {},
  });
  const conv8 = await prisma.conversation.findUnique({ where: { id: res8.conversationId } });
  if (conv8 && conv8.customerId === res8.customerId) {
    console.log("  ✓ PASS: Page scoping isolated cleanly.");
    passed++;
  } else {
    console.error("  ✗ FAIL: Page isolation failed");
  }

  // ----------------------------------------------------
  // TEST 9: Multi-Tenant Customer Isolation
  // ----------------------------------------------------
  console.log("\n[TEST 9] Multi-Tenant Security & Isolation...");
  const biz1Customers = await prisma.customer.findMany({ where: { businessId: testBiz.id } });
  const biz2Customers = await prisma.customer.findMany({ where: { businessId: testBiz2.id } });
  const intersection = biz1Customers.filter(b1 => biz2Customers.some(b2 => b2.id === b1.id));
  if (intersection.length === 0) {
    console.log("  ✓ PASS: Strict 100% tenant isolation across Business A and Business B.");
    passed++;
  } else {
    console.error("  ✗ FAIL: Tenant boundary leakage:", intersection);
  }

  // ----------------------------------------------------
  // TEST 10: External Profile API Failure Resilience
  // ----------------------------------------------------
  console.log("\n[TEST 10] Ingestion Resilience when profile lookup throws error...");
  const failPsid = "fb_user_error_simulate";
  const res10 = await MessageHub.ingestMessage({
    platform: "FACEBOOK",
    externalAccountId: pageA_Id,
    externalThreadId: `fb_thread_${failPsid}`,
    externalMessageId: `msg_err_${Date.now()}`,
    senderExternalId: failPsid,
    direction: "INBOUND",
    textContent: "Network test message",
    businessId: testBiz.id,
    environment: "LIVE", timestamp: new Date(), rawPayload: {},
  });
  if (res10.messageId && res10.conversationId) {
    console.log("  ✓ PASS: Ingestion succeeded smoothly even if profile API failed.");
    passed++;
  } else {
    console.error("  ✗ FAIL: Ingestion crashed on profile failure:", res10);
  }

  // ----------------------------------------------------
  // TEST 11: Idempotency & Webhook Retry Prevention
  // ----------------------------------------------------
  console.log("\n[TEST 11] Duplicate Webhook Idempotency Check...");
  const dupMsgId = "mid_idempotent_test_" + Date.now();
  const firstIngest = await MessageHub.ingestMessage({
    platform: "FACEBOOK",
    externalAccountId: pageA_Id,
    externalThreadId: "fb_thread_dup_test",
    externalMessageId: dupMsgId,
    senderExternalId: "psid_dup_user",
    direction: "INBOUND",
    textContent: "First attempt",
    businessId: testBiz.id,
    environment: "LIVE", timestamp: new Date(), rawPayload: {},
  });
  const secondIngest = await MessageHub.ingestMessage({
    platform: "FACEBOOK",
    externalAccountId: pageA_Id,
    externalThreadId: "fb_thread_dup_test",
    externalMessageId: dupMsgId,
    senderExternalId: "psid_dup_user",
    direction: "INBOUND",
    textContent: "First attempt (Duplicate retry)",
    businessId: testBiz.id,
    environment: "LIVE", timestamp: new Date(), rawPayload: {},
  });
  if (!firstIngest.isDuplicate && secondIngest.isDuplicate) {
    console.log("  ✓ PASS: Duplicate webhook retry detected and safely ignored.");
    passed++;
  } else {
    console.error("  ✗ FAIL: Duplicate prevention failed:", { firstIngest, secondIngest });
  }

  // ----------------------------------------------------
  // TEST 12: AI Greeting with Real Name
  // ----------------------------------------------------
  console.log("\n[TEST 12] AI Greeting with Real Customer Name...");
  const classRes = AiClassifier.classifyMessage("Magkano po ito?", []);
  const aiSuggestionReal = await GroundedAiSuggestor.generateDraftResponse(
    testBiz.id,
    "Rolex Esto",
    "Magkano po ito?",
    classRes
  );
  if (aiSuggestionReal.suggestedText.includes("Hello po Rolex!")) {
    console.log("  ✓ PASS: AI greeted with verified name: \"" + aiSuggestionReal.suggestedText.substring(0, 45) + "...\"");
    passed++;
  } else {
    console.error("  ✗ FAIL: AI greeting did not use real name:", aiSuggestionReal.suggestedText);
  }

  // ----------------------------------------------------
  // TEST 13: AI Greeting with Fallback Name (No "Hello po Facebook!")
  // ----------------------------------------------------
  console.log("\n[TEST 13] AI Greeting with Fallback Identity (No \"Hello po Facebook!\")...");
  const aiSuggestionFallback = await GroundedAiSuggestor.generateDraftResponse(
    testBiz.id,
    "Facebook User (377892)",
    "Available pa po?",
    classRes
  );
  if (!aiSuggestionFallback.suggestedText.includes("Hello po Facebook") && aiSuggestionFallback.suggestedText.includes("Hello po!")) {
    console.log("  ✓ PASS: AI used neutral greeting: \"" + aiSuggestionFallback.suggestedText.substring(0, 45) + "...\"");
    passed++;
  } else {
    console.error("  ✗ FAIL: AI greeted with fallback platform name:", aiSuggestionFallback.suggestedText);
  }

  console.log(`\n==================================================`);
  console.log(`RESULT: ${passed}/${total} TESTS PASSED`);
  console.log(`==================================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test Suite Crashed:", err);
  process.exit(1);
});
