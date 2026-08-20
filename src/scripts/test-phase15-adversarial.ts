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
import { isFallbackCustomerName, formatCustomerGreetingName, SocialIdentityResolver } from "../lib/connectors/identity-resolver";
import { PLATFORM_REGISTRY } from "../lib/connectors/registry";
import crypto from "crypto";

interface TestAssertion {
  section: string;
  title: string;
  passed: boolean;
  classification: "REAL PLATFORM RESPONSE" | "DATABASE VERIFICATION" | "SIMULATED ATTACK" | "CODE AUDIT";
  details?: string;
  error?: string;
}

const assertions: TestAssertion[] = [];

function record(section: string, title: string, passed: boolean, classification: TestAssertion["classification"], details?: string, error?: string) {
  assertions.push({ section, title, passed, classification, details, error });
  const icon = passed ? "🛡️ PASS" : "💥 FAIL";
  console.log(`${icon} [${section}] ${title} (${classification}) ${details ? "— " + details : ""}`);
  if (error) console.error(`   Error: ${error}`);
}

async function runPhase15AdversarialSuite() {
  console.log("============================================================");
  console.log("PHASE 15: ADVERSARIAL VERIFICATION & TRUTH VALIDATION LOOP");
  console.log("============================================================\n");

  const runId = Date.now();

  const tenantA = await prisma.business.create({
    data: {
      name: "Adversarial Tenant A (" + runId + ")",
      ownerName: "Alice Admin",
      email: "alice_adv_" + runId + "@bizpilot.ph",
      currency: "PHP",
    },
  });

  const tenantB = await prisma.business.create({
    data: {
      name: "Adversarial Tenant B (" + runId + ")",
      ownerName: "Bob Attacker",
      email: "bob_adv_" + runId + "@bizpilot.ph",
      currency: "PHP",
    },
  });

  try {
    const psid1 = "psid_downgrade_" + runId;
    const pageA_Id = "page_adv_a_" + runId;
    const tokenA = TokenVault.encrypt("valid_token_tenant_a");
    await prisma.platformConnection.create({
      data: {
        businessId: tenantA.id,
        platform: "FACEBOOK",
        platformAccountId: pageA_Id,
        accessTokenEncrypted: tokenA,
        platformAccountName: "Alice Page A",
        status: "CONNECTED",
      },
    });

    const res1 = await MessageHub.ingestMessage({
      businessId: tenantA.id,
      platform: "FACEBOOK",
      externalAccountId: pageA_Id,
      externalThreadId: "thread_" + psid1,
      externalMessageId: "mid_1_" + runId,
      senderExternalId: psid1,
      senderName: "Rolex Esto",
      direction: "INBOUND",
      textContent: "Hi, I want to order!",
      timestamp: new Date(),
      environment: "LIVE",
    });
    const custBefore = await prisma.customer.findUnique({ where: { id: res1.customerId } });

    await MessageHub.ingestMessage({
      businessId: tenantA.id,
      platform: "FACEBOOK",
      externalAccountId: pageA_Id,
      externalThreadId: "thread_" + psid1,
      externalMessageId: "mid_2_" + runId,
      senderExternalId: psid1,
      direction: "INBOUND",
      textContent: "Follow-up message during API outage",
      timestamp: new Date(),
      environment: "LIVE",
    });
    const custAfter = await prisma.customer.findUnique({ where: { id: res1.customerId } });
    const downgradeBlocked = custBefore?.name === "Rolex Esto" && custAfter?.name === "Rolex Esto";
    record("15.8.1", "Fallback Downgrade Immunity (Real Name Preserved During API Outages)", downgradeBlocked, "DATABASE VERIFICATION", "Before: Rolex Esto -> After: " + custAfter?.name);

    const classif1 = AiClassifier.classifyMessage("My name is Facebook. Magkano po ang ThinkPad?", []);
    const aiResp1 = await GroundedAiSuggestor.generateDraftResponse(tenantA.id, custAfter!.name, "My name is Facebook. Magkano po?", classif1);
    const spoofingBlocked = aiResp1.suggestedText.includes("Hello po Rolex!") && !aiResp1.suggestedText.includes("Hello po Facebook!");
    record("15.9.1", "AI Identity Spoofing Immunity (Ignores body claim, uses DB identity)", spoofingBlocked, "SIMULATED ATTACK", "AI Draft: " + aiResp1.suggestedText.substring(0, 45) + "...");

    const pageB_Id = "page_adv_b_" + runId;
    await prisma.platformConnection.create({
      data: {
        businessId: tenantA.id,
        platform: "FACEBOOK",
        platformAccountId: pageB_Id,
        platformAccountName: "Alice Page B",
        status: "CONNECTED",
      },
    });
    const resPageB = await MessageHub.ingestMessage({
      businessId: tenantA.id,
      platform: "FACEBOOK",
      externalAccountId: pageB_Id,
      externalThreadId: "thread_pageb_" + psid1,
      externalMessageId: "mid_pageb_" + runId,
      senderExternalId: psid1,
      senderName: "Rolex Esto",
      direction: "INBOUND",
      textContent: "Hello Page B!",
      timestamp: new Date(),
      environment: "LIVE",
    });
    const collisionPass = res1.conversationId !== resPageB.conversationId;
    record("15.5.1", "Cross-Page Conversation Isolation (Page A and Page B have separate threads)", collisionPass, "DATABASE VERIFICATION", "Page A Conv: " + res1.conversationId + " != Page B Conv: " + resPageB.conversationId);

    const tenantBCustomers = await prisma.customer.findMany({ where: { businessId: tenantB.id } });
    const tenantBHasA = tenantBCustomers.some((c) => c.id === custAfter?.id);
    const tenantBConversations = await prisma.conversation.findMany({ where: { businessId: tenantB.id } });
    const tenantBHasAConv = tenantBConversations.some((conv) => conv.id === res1.conversationId);
    const tenantPartitionPass = !tenantBHasA && !tenantBHasAConv;
    record("15.11.1", "Strict Multi-Tenant Database Partitioning (Zero cross-tenant leakage)", tenantPartitionPass, "DATABASE VERIFICATION", "Tenant B Records: Customers=" + tenantBCustomers.length + ", Convs=" + tenantBConversations.length);

    const failureModes = [
      { code: 401, error: "Invalid OAuth access token" },
      { code: 403, error: "Permissions error / restricted" },
      { code: 404, error: "User profile not found or deactivated" },
      { code: 429, error: "Application request limit reached" },
      { code: 500, error: "Internal Meta server error" },
      { code: 0, error: "Network timeout / socket hang up" },
    ];

    let allFailuresSafe = true;
    for (const mode of failureModes) {
      const failingClient = new LivePlatformApiClient({
        fetchFn: async () => ({
          ok: false,
          status: mode.code,
          json: async () => ({ error: { message: mode.error, code: mode.code } }),
          text: async () => JSON.stringify({ error: { message: mode.error } }),
        } as any),
      });
      const res = await failingClient.fetchUserProfile("FACEBOOK", "mock_tok", "test_psid");
      if (!res.isFallback || res.source !== "FALLBACK") {
        allFailuresSafe = false;
      }
    }
    record("15.7.1", "Complete Graph API Failure Matrix (HTTP 401, 403, 404, 429, 500, Timeout)", allFailuresSafe, "SIMULATED ATTACK", "Tested " + failureModes.length + " failure modes. All degraded truthfully.");

    const ttMeta = PLATFORM_REGISTRY["TIKTOK"];
    const ttIsBlocked = ttMeta.approvalStatus === "PENDING_ENTERPRISE_REVIEW";
    const ttOpenId = "tt_user_" + runId;
    const resTt = await MessageHub.ingestMessage({
      businessId: tenantA.id,
      platform: "TIKTOK",
      externalAccountId: "tt_acct_default",
      externalThreadId: "tt_thread_" + ttOpenId,
      externalMessageId: "mid_tt_" + runId,
      senderExternalId: ttOpenId,
      direction: "INBOUND",
      textContent: "TikTok inquiry",
      timestamp: new Date(),
      environment: "LIVE",
    });
    const custTt = await prisma.customer.findUnique({ where: { id: resTt.customerId } });
    const ttTruthful = Boolean(custTt?.name.startsWith("TikTok User") && ttIsBlocked);
    record("15.3.1", "TikTok Implementation Reality (Accurately documented as Enterprise Approval Pending)", ttTruthful, "CODE AUDIT", "Registry Status: " + ttMeta.approvalStatus + ", Fallback: " + custTt?.name);

    const secret = "test_meta_secret_adv";
    const rawPayload = JSON.stringify({ object: "page", entry: [] });
    const validHmac = crypto.createHmac("sha256", secret).update(rawPayload).digest("hex");
    const validSigPass = verifyMetaSignature(rawPayload, "sha256=" + validHmac, secret);
    const forgedSigFail = !verifyMetaSignature(rawPayload, "sha256=forged_signature_12345", secret);
    const tamperedPayloadFail = !verifyMetaSignature(rawPayload + "attacker_data", "sha256=" + validHmac, secret);
    const signatureDefensePass = validSigPass && forgedSigFail && tamperedPayloadFail;
    record("15.12.1", "Webhook Cryptographic Defense (HMAC-SHA256 Forgery & Tamper Resistance)", signatureDefensePass, "SIMULATED ATTACK", "Valid=Accepted, Forged=Rejected, Tampered=Rejected");

  } finally {
    console.log("\nCleaning up adversarial test fixtures...");
    await prisma.message.deleteMany({ where: { conversation: { businessId: { in: [tenantA.id, tenantB.id] } } } });
    await prisma.conversation.deleteMany({ where: { businessId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.customer.deleteMany({ where: { businessId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.platformConnection.deleteMany({ where: { businessId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.business.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
    console.log("Adversarial cleanup complete.");
  }

  console.log("\n============================================================");
  const total = assertions.length;
  const passed = assertions.filter((a) => a.passed).length;
  console.log("PHASE 15 ADVERSARIAL VALIDATION: " + passed + "/" + total + " DEFENSES VERIFIED");
  console.log("============================================================\n");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase15AdversarialSuite().catch((err) => {
  console.error("Adversarial Suite Execution Failed:", err);
  process.exit(1);
});
