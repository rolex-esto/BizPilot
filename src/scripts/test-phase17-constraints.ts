import { prisma } from "../lib/prisma";
import { MessageHub } from "../lib/connectors/hub";
import { TokenVault } from "../lib/connectors/token-vault";

interface ConstraintAssertion {
  testId: string;
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const assertions: ConstraintAssertion[] = [];

function record(testId: string, name: string, passed: boolean, details?: string, error?: string) {
  assertions.push({ testId, name, passed, details, error });
  const icon = passed ? "🔒 PASS" : "💥 FAIL";
  console.log(`${icon} [${testId}] ${name} ${details ? "— " + details : ""}`);
  if (error) console.error(`   Error: ${error}`);
}

async function runPhase17Audit() {
  console.log("============================================================");
  console.log("PHASE 17: DATABASE IDENTITY CONSTRAINT AUDIT & LIVE TEST");
  console.log("============================================================\n");

  const runId = Date.now();

  const tenantA = await prisma.business.create({
    data: {
      name: "Constraint Tenant A (" + runId + ")",
      ownerName: "Alice MSME",
      email: "alice_c_" + runId + "@test.ph",
      currency: "PHP",
    },
  });

  const tenantB = await prisma.business.create({
    data: {
      name: "Constraint Tenant B (" + runId + ")",
      ownerName: "Bob MSME",
      email: "bob_c_" + runId + "@test.ph",
      currency: "PHP",
    },
  });

  try {
    const senderX = "sender_x_" + runId;
    const pageA_Id = "page_a_" + runId;
    const pageB_Id = "page_b_" + runId;

    // 1. TENANT A: Facebook Page A (Sender X)
    const resA_PageA = await MessageHub.ingestMessage({
      businessId: tenantA.id,
      platform: "FACEBOOK",
      externalAccountId: pageA_Id,
      externalThreadId: "thread_a_" + senderX,
      externalMessageId: "mid_a_pageA_" + runId,
      senderExternalId: senderX,
      senderName: "Sender X",
      direction: "INBOUND",
      textContent: "Hello on Page A",
      timestamp: new Date(),
      environment: "LIVE",
    });

    // 2. TENANT A: Facebook Page B (Sender X)
    const resA_PageB = await MessageHub.ingestMessage({
      businessId: tenantA.id,
      platform: "FACEBOOK",
      externalAccountId: pageB_Id,
      externalThreadId: "thread_b_" + senderX,
      externalMessageId: "mid_a_pageB_" + runId,
      senderExternalId: senderX,
      senderName: "Sender X",
      direction: "INBOUND",
      textContent: "Hello on Page B",
      timestamp: new Date(),
      environment: "LIVE",
    });

    const crossPageThreadIsolated = resA_PageA.conversationId !== resA_PageB.conversationId;
    record("17.1", "Tenant A: Facebook Page A vs Page B (Thread-Isolated Conversations)", crossPageThreadIsolated, "Page A Conv: " + resA_PageA.conversationId + " != Page B Conv: " + resA_PageB.conversationId);

    // 3. TENANT B: Facebook Page A (Sender X)
    const resB_PageA = await MessageHub.ingestMessage({
      businessId: tenantB.id,
      platform: "FACEBOOK",
      externalAccountId: pageA_Id,
      externalThreadId: "thread_b_pageA_" + senderX,
      externalMessageId: "mid_b_pageA_" + runId,
      senderExternalId: senderX,
      senderName: "Sender X",
      direction: "INBOUND",
      textContent: "Hello Tenant B",
      timestamp: new Date(),
      environment: "LIVE",
    });

    const crossTenantCustomerIsolated = resA_PageA.customerId !== resB_PageA.customerId && resA_PageA.conversationId !== resB_PageA.conversationId;
    record("17.2", "Tenant A vs Tenant B: Sender X on Page A (Strict Multi-Tenant Isolation)", crossTenantCustomerIsolated, "Tenant A Cust: " + resA_PageA.customerId + " != Tenant B Cust: " + resB_PageA.customerId);

    // 4. TENANT A: Instagram (Sender X) vs WhatsApp (Sender X)
    const resA_Ig = await MessageHub.ingestMessage({
      businessId: tenantA.id,
      platform: "INSTAGRAM",
      externalAccountId: "ig_acct",
      externalThreadId: "thread_ig_" + senderX,
      externalMessageId: "mid_a_ig_" + runId,
      senderExternalId: senderX,
      senderName: "Sender X",
      direction: "INBOUND",
      textContent: "Hello Instagram",
      timestamp: new Date(),
      environment: "LIVE",
    });

    const resA_Wa = await MessageHub.ingestMessage({
      businessId: tenantA.id,
      platform: "WHATSAPP",
      externalAccountId: "waba_acct",
      externalThreadId: "thread_wa_" + senderX,
      externalMessageId: "mid_a_wa_" + runId,
      senderExternalId: senderX,
      senderName: "Sender X",
      direction: "INBOUND",
      textContent: "Hello WhatsApp",
      timestamp: new Date(),
      environment: "LIVE",
    });

    const crossPlatformIndependence = resA_PageA.customerId !== resA_Ig.customerId && resA_Ig.customerId !== resA_Wa.customerId;
    record("17.3", "Tenant A: Facebook vs Instagram vs WhatsApp (Cross-Platform Identity Independence)", crossPlatformIndependence, "FB Cust: " + resA_PageA.customerId + " != IG Cust: " + resA_Ig.customerId + " != WA Cust: " + resA_Wa.customerId);

    // 5. MULTI-TENANT CustomerIdentityLink COEXISTENCE TEST
    // Tenant A links its customer to shared IG ID, Tenant B links its customer to the same shared IG ID
    const sharedIgId = "shared_ig_user_" + runId;
    const linkTenantA = await prisma.customerIdentityLink.create({
      data: {
        businessId: tenantA.id,
        customerId: resA_PageA.customerId!,
        platform: "INSTAGRAM",
        externalId: sharedIgId,
        externalName: "Shared IG User",
      },
    });

    const linkTenantB = await prisma.customerIdentityLink.create({
      data: {
        businessId: tenantB.id,
        customerId: resB_PageA.customerId!,
        platform: "INSTAGRAM",
        externalId: sharedIgId,
        externalName: "Shared IG User",
      },
    });

    const multiTenantLinkPass = !!linkTenantA && !!linkTenantB && linkTenantA.id !== linkTenantB.id;
    record("17.4", "Multi-Tenant CustomerIdentityLink Coexistence (Tenant A & B can link same external user)", multiTenantLinkPass, "Link A: " + linkTenantA.id + ", Link B: " + linkTenantB.id);

    // 6. SAME-BUSINESS DUPLICATE LINK REJECTION
    let dupLinkRejected = false;
    try {
      await prisma.customerIdentityLink.create({
        data: {
          businessId: tenantA.id,
          customerId: resA_PageA.customerId!,
          platform: "INSTAGRAM",
          externalId: sharedIgId,
          externalName: "Duplicate Link Attempt",
        },
      });
    } catch {
      dupLinkRejected = true;
    }
    record("17.5", "Same-Business Duplicate Identity Link Rejection (Enforces @@unique([businessId, platform, externalId]))", dupLinkRejected, "Duplicate link blocked cleanly by PostgreSQL");

    // 7. GLOBAL MESSAGE IDEMPOTENCY
    let dupMessageRejected = false;
    try {
      await prisma.message.create({
        data: {
          conversationId: resA_PageA.conversationId!,
          customerId: resA_PageA.customerId!,
          platform: "FACEBOOK",
          externalMessageId: "mid_a_pageA_" + runId,
          direction: "INBOUND",
          textContent: "Duplicate mid attempt",
        },
      });
    } catch {
      dupMessageRejected = true;
    }
    record("17.6", "Message Idempotency Uniqueness (Enforces @unique on externalMessageId)", dupMessageRejected, "Duplicate message ID blocked cleanly by PostgreSQL");

  } finally {
    console.log("\nCleaning up Phase 17 audit fixtures...");
    await prisma.message.deleteMany({ where: { conversation: { businessId: { in: [tenantA.id, tenantB.id] } } } });
    await prisma.conversation.deleteMany({ where: { businessId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.customerIdentityLink.deleteMany({ where: { customer: { businessId: { in: [tenantA.id, tenantB.id] } } } });
    await prisma.customer.deleteMany({ where: { businessId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.platformConnection.deleteMany({ where: { businessId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.business.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
    console.log("Phase 17 audit cleanup complete.");
  }

  console.log("\n============================================================");
  const total = assertions.length;
  const passed = assertions.filter((a) => a.passed).length;
  console.log("PHASE 17 DATABASE CONSTRAINT AUDIT: " + passed + "/" + total + " PASSED");
  console.log("============================================================\n");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase17Audit().catch((err) => {
  console.error("Phase 17 Audit Execution Failed:", err);
  process.exit(1);
});
