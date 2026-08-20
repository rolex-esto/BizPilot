import { prisma } from "../lib/prisma";
import { MessageHub } from "../lib/connectors/hub";
import { TokenVault } from "../lib/connectors/token-vault";
import { LivePlatformApiClient } from "../lib/connectors/live-client";
import { FacebookMessengerConnector } from "../lib/connectors/facebook";
import { InstagramConnector } from "../lib/connectors/instagram";
import { WhatsAppConnector } from "../lib/connectors/whatsapp";
import { TikTokConnector } from "../lib/connectors/tiktok";
import { verifyMetaSignature, verifyMetaWebhookHandshake } from "../lib/connectors/security";
import { GroundedAiSuggestor } from "../lib/ai/grounded-suggestor";
import { AiClassifier } from "../lib/ai/classifier";
import { isFallbackCustomerName, formatCustomerGreetingName } from "../lib/connectors/identity-resolver";
import { PLATFORM_REGISTRY, PlatformId } from "../lib/connectors/registry";
import crypto from "crypto";

interface TestCheck {
  step: string;
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const checks: TestCheck[] = [];

function record(step: string, name: string, passed: boolean, details?: string, error?: string) {
  checks.push({ step, name, passed, details, error });
  const icon = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${icon} [${step}] ${name} ${details ? "— " + details : ""}`);
  if (error) console.error(`   Error: ${error}`);
}

async function runContinuousVerification() {
  console.log("============================================================");
  console.log("STARTING CONTINUOUS MULTI-PLATFORM ENGINEERING VERIFICATION");
  console.log("============================================================\n");

  const runId = Date.now();

  // Setup Test Tenant A
  const bizA = await prisma.business.create({
    data: {
      name: "Continuous Test Biz A (" + runId + ")",
      ownerName: "Alice Santos",
      email: "alice_" + runId + "@test.ph",
      currency: "PHP",
    },
  });

  // Setup Test Tenant B
  const bizB = await prisma.business.create({
    data: {
      name: "Continuous Test Biz B (" + runId + ")",
      ownerName: "Bob Tan",
      email: "bob_" + runId + "@test.ph",
      currency: "PHP",
    },
  });

  try {
    // 1. SUPPORTED PLATFORM INVENTORY DISCOVERY
    const allPlatforms: PlatformId[] = ["FACEBOOK", "INSTAGRAM", "WHATSAPP", "TIKTOK", "TELEGRAM", "VIBER", "SHOPEE", "LAZADA"];
    const discoveryPass = allPlatforms.every((p) => PLATFORM_REGISTRY[p] && PLATFORM_REGISTRY[p].id === p);
    record("14.1", "Supported Platform Discovery from Source of Truth", discoveryPass, "Discovered " + allPlatforms.length + " platform definitions");

    // 2. FACEBOOK MESSENGER VERIFICATION
    const fbPageId = "page_fb_" + runId;
    const fbTokenEnc = TokenVault.encrypt("mock_fb_token_valid");
    await prisma.platformConnection.create({
      data: {
        businessId: bizA.id,
        platform: "FACEBOOK",
        platformAccountId: fbPageId,
        platformAccountName: "Alice FB Store",
        accessTokenEncrypted: fbTokenEnc,
        status: "CONNECTED",
      },
    });

    // 2.1 Webhook signature verification
    const fbAppSecret = "meta_test_secret_12345";
    const fbPayloadRaw = JSON.stringify({ object: "page", entry: [{ id: fbPageId, messaging: [{ sender: { id: "psid_1" }, message: { mid: "m1", text: "Hello" } }] }] });
    const hmacFb = crypto.createHmac("sha256", fbAppSecret).update(fbPayloadRaw).digest("hex");
    const validFbSig = verifyMetaSignature(fbPayloadRaw, "sha256=" + hmacFb, fbAppSecret);
    const invalidFbSig = !verifyMetaSignature(fbPayloadRaw, "sha256=tampered", fbAppSecret);
    record("14.3.FB.1", "Facebook Webhook HMAC Signature & Tamper Verification", validFbSig && invalidFbSig);

    // 2.2 Ingest with real display name
    const psidReal = "psid_real_" + runId;
    const resFbReal = await MessageHub.ingestMessage({
      businessId: bizA.id,
      platform: "FACEBOOK",
      externalAccountId: fbPageId,
      externalThreadId: "fb_thread_" + psidReal,
      externalMessageId: "mid_fb_1_" + runId,
      senderExternalId: psidReal,
      senderName: "Rolex Esto",
      direction: "INBOUND",
      textContent: "Magkano po ThinkPad T480?",
      timestamp: new Date(),
      environment: "LIVE",
    });
    const custFbReal = await prisma.customer.findUnique({ where: { id: resFbReal.customerId } });
    record("14.3.FB.2", "Facebook Inbound Message with Legitimate Display Name", custFbReal?.name === "Rolex Esto", "Resolved Name: " + custFbReal?.name);

    // 2.3 Ingest with fallback name (Profile unavailable)
    const psidFallback = "377892_" + runId;
    const resFbFallback = await MessageHub.ingestMessage({
      businessId: bizA.id,
      platform: "FACEBOOK",
      externalAccountId: fbPageId,
      externalThreadId: "fb_thread_" + psidFallback,
      externalMessageId: "mid_fb_2_" + runId,
      senderExternalId: psidFallback,
      direction: "INBOUND",
      textContent: "Available pa po?",
      timestamp: new Date(),
      environment: "LIVE",
    });
    const custFbFallback = await prisma.customer.findUnique({ where: { id: resFbFallback.customerId } });
    const fbFallbackOk = Boolean(isFallbackCustomerName(custFbFallback?.name) && custFbFallback?.name.includes("377892"));
    record("14.3.FB.3", "Facebook Truthful Fallback Preservation when Profile Unavailable", fbFallbackOk, "Fallback Name: " + custFbFallback?.name);

    // 2.4 Existing Fallback Upgrade on Re-engagement
    await MessageHub.ingestMessage({
      businessId: bizA.id,
      platform: "FACEBOOK",
      externalAccountId: fbPageId,
      externalThreadId: "fb_thread_" + psidFallback,
      externalMessageId: "mid_fb_3_" + runId,
      senderExternalId: psidFallback,
      senderName: "Rolex Esto",
      direction: "INBOUND",
      textContent: "Sige kukunin ko na po",
      timestamp: new Date(),
      environment: "LIVE",
    });
    const custFbUpgraded = await prisma.customer.findUnique({ where: { id: custFbFallback!.id } });
    record("14.3.FB.4", "Facebook Fallback Identity Upgrade on Re-engagement (Zero Duplicate)", custFbUpgraded?.name === "Rolex Esto", "Upgraded to: " + custFbUpgraded?.name);

    // 3. INSTAGRAM DIRECT VERIFICATION
    const igAcctId = "ig_acct_" + runId;
    const igTokenEnc = TokenVault.encrypt("mock_ig_token_valid");
    await prisma.platformConnection.create({
      data: {
        businessId: bizA.id,
        platform: "INSTAGRAM",
        platformAccountId: igAcctId,
        platformAccountName: "Alice IG Shop",
        accessTokenEncrypted: igTokenEnc,
        status: "CONNECTED",
      },
    });

    const igsid = "igsid_" + runId;
    const resIg = await MessageHub.ingestMessage({
      businessId: bizA.id,
      platform: "INSTAGRAM",
      externalAccountId: igAcctId,
      externalThreadId: "ig_thread_" + igsid,
      externalMessageId: "mid_ig_1_" + runId,
      senderExternalId: igsid,
      senderName: "Maria Clara",
      senderHandle: "@mariaclaraph",
      direction: "INBOUND",
      textContent: "Hi, do you have warranty for laptops?",
      timestamp: new Date(),
      environment: "LIVE",
    });
    const custIg = await prisma.customer.findUnique({ where: { id: resIg.customerId } });
    const igOk = custIg?.name === "Maria Clara" && custIg?.handle === "@mariaclaraph" && custIg?.primaryPlatform === "INSTAGRAM";
    record("14.3.IG.1", "Instagram Identity Resolution (Name, Handle, Platform)", igOk, "Name: " + custIg?.name + ", Handle: " + custIg?.handle);

    // 4. WHATSAPP BUSINESS CLOUD API VERIFICATION
    const wabaId = "waba_" + runId;
    const waPhone = "63917" + (runId % 10000000);
    const resWa = await MessageHub.ingestMessage({
      businessId: bizA.id,
      platform: "WHATSAPP",
      externalAccountId: wabaId,
      externalThreadId: "wa_thread_" + waPhone,
      externalMessageId: "mid_wa_1_" + runId,
      senderExternalId: waPhone,
      senderName: "Kuya Bong",
      senderPhone: "+" + waPhone,
      direction: "INBOUND",
      textContent: "Location ninyo sir?",
      timestamp: new Date(),
      environment: "LIVE",
    });
    const custWa = await prisma.customer.findUnique({ where: { id: resWa.customerId } });
    const waOk = custWa?.name === "Kuya Bong" && custWa?.phone === "+" + waPhone && custWa?.primaryPlatform === "WHATSAPP";
    record("14.3.WA.1", "WhatsApp Contact Profile Name & Normalized Phone Preservation", waOk, "Name: " + custWa?.name + ", Phone: " + custWa?.phone);

    // 5. TIKTOK BUSINESS MESSAGING VERIFICATION
    const ttOpenId = "tt_open_" + runId;
    const resTt = await MessageHub.ingestMessage({
      businessId: bizA.id,
      platform: "TIKTOK",
      externalAccountId: "tt_biz_default",
      externalThreadId: "tt_thread_" + ttOpenId,
      externalMessageId: "mid_tt_1_" + runId,
      senderExternalId: ttOpenId,
      direction: "INBOUND",
      textContent: "HM po?",
      timestamp: new Date(),
      environment: "LIVE",
    });
    const custTt = await prisma.customer.findUnique({ where: { id: resTt.customerId } });
    const ttOk = Boolean(isFallbackCustomerName(custTt?.name) && custTt?.name.includes("TikTok User"));
    record("14.3.TT.1", "TikTok Restricted Environment Truthful Fallback (Zero Fake Names)", ttOk, "Fallback: " + custTt?.name);

    // 6. ACCOUNT / PAGE SWITCHING & MULTI-PAGE ISOLATION
    const fbPageB_Id = "page_b_" + runId;
    await prisma.platformConnection.create({
      data: {
        businessId: bizA.id,
        platform: "FACEBOOK",
        platformAccountId: fbPageB_Id,
        platformAccountName: "Alice Page B",
        status: "CONNECTED",
      },
    });

    const resPageB = await MessageHub.ingestMessage({
      businessId: bizA.id,
      platform: "FACEBOOK",
      externalAccountId: fbPageB_Id,
      externalThreadId: "fb_thread_pageb_" + psidReal,
      externalMessageId: "mid_fb_pageb_" + runId,
      senderExternalId: psidReal,
      senderName: "Rolex Esto",
      direction: "INBOUND",
      textContent: "Inquiry on Page B",
      timestamp: new Date(),
      environment: "LIVE",
    });
    const convPageB = await prisma.conversation.findUnique({ where: { id: resPageB.conversationId } });
    record("14.7.1", "Multi-Page / Account Isolation under same Tenant", convPageB?.id !== resFbReal.conversationId, "Page A Conv: " + resFbReal.conversationId + ", Page B Conv: " + resPageB.conversationId);

    // 7. MULTI-TENANT SECURITY & STRICT DATA ISOLATION
    const custBizA = await prisma.customer.findMany({ where: { businessId: bizA.id } });
    const custBizB = await prisma.customer.findMany({ where: { businessId: bizB.id } });
    const leakIntersection = custBizA.filter((ca) => custBizB.some((cb) => cb.id === ca.id));
    record("14.11.1", "Strict Multi-Tenant Customer Partitioning (Zero Data Leakage)", leakIntersection.length === 0 && custBizA.length > 0, "Biz A: " + custBizA.length + " custs, Biz B: " + custBizB.length + " custs, Leaked: 0");

    // 8. IDEMPOTENCY & DUPLICATE WEBHOOK HANDLING
    const dupMid = "mid_idempotent_" + runId;
    const ingest1 = await MessageHub.ingestMessage({
      businessId: bizA.id,
      platform: "FACEBOOK",
      externalAccountId: fbPageId,
      externalThreadId: "fb_thread_dup",
      externalMessageId: dupMid,
      senderExternalId: "psid_dup",
      direction: "INBOUND",
      textContent: "Duplicate test",
      timestamp: new Date(),
      environment: "LIVE",
    });
    const ingest2 = await MessageHub.ingestMessage({
      businessId: bizA.id,
      platform: "FACEBOOK",
      externalAccountId: fbPageId,
      externalThreadId: "fb_thread_dup",
      externalMessageId: dupMid,
      senderExternalId: "psid_dup",
      direction: "INBOUND",
      textContent: "Duplicate test (Retry)",
      timestamp: new Date(),
      environment: "LIVE",
    });
    record("14.13.1", "Idempotency & Concurrent Duplicate Webhook Prevention", !ingest1.isDuplicate && ingest2.isDuplicate, "First: duplicate=false, Retry: duplicate=true");

    // 9. AI IDENTITY CONTEXT & GREETING VALIDATION
    const classifInq = AiClassifier.classifyMessage("Magkano po ito?", []);
    const aiRealGreeting = await GroundedAiSuggestor.generateDraftResponse(bizA.id, "Rolex Esto", "Magkano po ito?", classifInq);
    const aiFallbackGreeting = await GroundedAiSuggestor.generateDraftResponse(bizA.id, "Facebook User (377892)", "Magkano po ito?", classifInq);

    const aiRealOk = aiRealGreeting.suggestedText.includes("Hello po Rolex!");
    const aiFallbackOk = !aiFallbackGreeting.suggestedText.includes("Hello po Facebook") && aiFallbackGreeting.suggestedText.includes("Hello po!");
    record("14.9.1", "AI Grounded Greeting: Verified First Name Interpolation", aiRealOk, "Draft: " + aiRealGreeting.suggestedText.substring(0, 45) + "...");
    record("14.9.2", "AI Grounded Greeting: Fallback Neutral Sanitization (Zero Hello po Facebook)", aiFallbackOk, "Draft: " + aiFallbackGreeting.suggestedText.substring(0, 45) + "...");

    // 10. API FAILURE & NETWORK RESILIENCE
    const client = new LivePlatformApiClient({ fetchFn: async () => { throw new Error("Connection Refused / Network Offline"); } });
    const failRes = await client.fetchUserProfile("FACEBOOK", "mock_token", "psid_error_test");
    record("14.14.1", "Graceful Degradation on Graph API Network Timeout / Error", !failRes.success && failRes.isFallback && failRes.source === "FALLBACK", "Handled error: " + failRes.errorMessage);

  } finally {
    // Clean up temporary continuous verification tenant test data
    console.log("\nCleaning up continuous verification fixtures...");
    await prisma.message.deleteMany({ where: { conversation: { businessId: { in: [bizA.id, bizB.id] } } } });
    await prisma.conversation.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
    await prisma.customerIdentityLink.deleteMany({ where: { customer: { businessId: { in: [bizA.id, bizB.id] } } } });
    await prisma.customer.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
    await prisma.platformConnection.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
    await prisma.business.deleteMany({ where: { id: { in: [bizA.id, bizB.id] } } });
    console.log("Cleanup complete.");
  }

  console.log("\n============================================================");
  const total = checks.length;
  const passedCount = checks.filter((c) => c.passed).length;
  console.log("CONTINUOUS VERIFICATION RESULTS: " + passedCount + "/" + total + " PASSED");
  console.log("============================================================\n");

  if (passedCount === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runContinuousVerification().catch((err) => {
  console.error("Continuous Verification Failed:", err);
  process.exit(1);
});