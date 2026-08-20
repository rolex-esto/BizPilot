import { prisma } from "../lib/prisma";
import { MessageHub } from "../lib/connectors/hub";

interface OwnershipAssertion {
  testId: string;
  title: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const assertions: OwnershipAssertion[] = [];

function record(testId: string, title: string, passed: boolean, details?: string, error?: string) {
  assertions.push({ testId, title, passed, details, error });
  const icon = passed ? "👑 PASS" : "💥 FAIL";
  console.log(`${icon} [${testId}] ${title} ${details ? "— " + details : ""}`);
  if (error) console.error(`   Error: ${error}`);
}

async function runPhase18OwnershipAudit() {
  console.log("============================================================");
  console.log("PHASE 18: FINAL CUSTOMER IDENTITY OWNERSHIP AUDIT");
  console.log("============================================================\n");

  const runId = Date.now();

  const tenantA = await prisma.business.create({
    data: {
      name: "Ownership Tenant A (" + runId + ")",
      ownerName: "Alice Owner",
      email: "alice_own_" + runId + "@bizpilot.ph",
      currency: "PHP",
    },
  });

  const tenantB = await prisma.business.create({
    data: {
      name: "Ownership Tenant B (" + runId + ")",
      ownerName: "Bob Owner",
      email: "bob_own_" + runId + "@bizpilot.ph",
      currency: "PHP",
    },
  });

  try {
    const senderX = "psid_own_" + runId;
    const pageA_Id = "page_own_a_" + runId;

    // ------------------------------------------------------------
    // TEST 1: Same Tenant Inbound Ingestion Reuses Customer
    // ------------------------------------------------------------
    const res1 = await MessageHub.ingestMessage({
      businessId: tenantA.id,
      platform: "FACEBOOK",
      externalAccountId: pageA_Id,
      externalThreadId: "thread_" + senderX,
      externalMessageId: "mid_own_1_" + runId,
      senderExternalId: senderX,
      senderName: "Customer X",
      direction: "INBOUND",
      textContent: "Message 1",
      timestamp: new Date(),
      environment: "LIVE",
    });

    const res2 = await MessageHub.ingestMessage({
      businessId: tenantA.id,
      platform: "FACEBOOK",
      externalAccountId: pageA_Id,
      externalThreadId: "thread_" + senderX,
      externalMessageId: "mid_own_2_" + runId,
      senderExternalId: senderX,
      senderName: "Customer X",
      direction: "INBOUND",
      textContent: "Message 2",
      timestamp: new Date(),
      environment: "LIVE",
    });

    const sameCustomerReused = res1.customerId === res2.customerId;
    record("18.2.Test1", "Same-Tenant Same-Platform Sender Reuses Single Customer Record", sameCustomerReused, "Customer 1 ID: " + res1.customerId + " === Customer 2 ID: " + res2.customerId);

    // ------------------------------------------------------------
    // TEST 2: Same-Tenant Duplicate Identity Link Blocked by PostgreSQL
    // ------------------------------------------------------------
    const otherCustA = await prisma.customer.create({
      data: {
        businessId: tenantA.id,
        primaryPlatform: "MANUAL",
        name: "Customer Beta",
        environment: "LIVE",
      },
    });

    // Link customer 1 to IG account
    const igSharedId = "ig_shared_" + runId;
    await prisma.customerIdentityLink.create({
      data: {
        businessId: tenantA.id,
        customerId: res1.customerId!,
        platform: "INSTAGRAM",
        externalId: igSharedId,
        externalName: "Instagram User",
      },
    });

    // Attempt to link Customer Beta in Tenant A to the SAME Instagram account
    let duplicateLinkBlocked = false;
    try {
      await prisma.customerIdentityLink.create({
        data: {
          businessId: tenantA.id,
          customerId: otherCustA.id,
          platform: "INSTAGRAM",
          externalId: igSharedId,
          externalName: "Instagram User (Collision Attempt)",
        },
      });
    } catch {
      duplicateLinkBlocked = true;
    }
    record("18.2.Test2", "Same-Tenant Duplicate Identity Link Rejection (Enforces @@unique([businessId, platform, externalId]))", duplicateLinkBlocked, "Blocked second customer in Tenant A from claiming same IG identity");

    // ------------------------------------------------------------
    // TEST 3: Multi-Tenant Coexistence (Tenant B CAN link same IG account)
    // ------------------------------------------------------------
    const custTenantB = await prisma.customer.create({
      data: {
        businessId: tenantB.id,
        primaryPlatform: "MANUAL",
        name: "Tenant B Customer",
        environment: "LIVE",
      },
    });

    const linkTenantB = await prisma.customerIdentityLink.create({
      data: {
        businessId: tenantB.id,
        customerId: custTenantB.id,
        platform: "INSTAGRAM",
        externalId: igSharedId,
        externalName: "Instagram User (Tenant B)",
      },
    });
    const multiTenantLinkOk = !!linkTenantB && linkTenantB.businessId === tenantB.id;
    record("18.2.Test3", "Multi-Tenant Coexistence (Tenant B successfully links same IG account independently)", multiTenantLinkOk, "Tenant B Link ID: " + linkTenantB.id);

    // ------------------------------------------------------------
    // TEST 4: Cross-Platform Independence
    // ------------------------------------------------------------
    const resIg = await MessageHub.ingestMessage({
      businessId: tenantA.id,
      platform: "INSTAGRAM",
      externalAccountId: "ig_main",
      externalThreadId: "thread_ig_" + senderX,
      externalMessageId: "mid_ig_ind_" + runId,
      senderExternalId: senderX,
      senderName: "Customer X (IG)",
      direction: "INBOUND",
      textContent: "IG Message",
      timestamp: new Date(),
      environment: "LIVE",
    });
    const crossPlatformSeparate = res1.customerId !== resIg.customerId;
    record("18.2.Test4", "Cross-Platform Identities with Identical String Remain Independent", crossPlatformSeparate, "FB Cust: " + res1.customerId + " != IG Cust: " + resIg.customerId);

    // ------------------------------------------------------------
    // TEST 5: WhatsApp Phone Identity Reuse
    // ------------------------------------------------------------
    const waPhone = "63917" + (runId % 10000000);
    const resWa1 = await MessageHub.ingestMessage({
      businessId: tenantA.id,
      platform: "WHATSAPP",
      externalAccountId: "waba_main",
      externalThreadId: "thread_wa_" + waPhone,
      externalMessageId: "mid_wa_1_" + runId,
      senderExternalId: waPhone,
      senderName: "WhatsApp Contact",
      senderPhone: "+" + waPhone,
      direction: "INBOUND",
      textContent: "WA Message 1",
      timestamp: new Date(),
      environment: "LIVE",
    });

    const resWa2 = await MessageHub.ingestMessage({
      businessId: tenantA.id,
      platform: "WHATSAPP",
      externalAccountId: "waba_main",
      externalThreadId: "thread_wa_" + waPhone,
      externalMessageId: "mid_wa_2_" + runId,
      senderExternalId: waPhone,
      senderName: "WhatsApp Contact",
      senderPhone: "+" + waPhone,
      direction: "INBOUND",
      textContent: "WA Message 2",
      timestamp: new Date(),
      environment: "LIVE",
    });
    const waCustomerReused = resWa1.customerId === resWa2.customerId;
    record("18.2.Test5", "WhatsApp Phone Ingestion Reuses Exact Same Customer Record", waCustomerReused, "WA Cust 1: " + resWa1.customerId + " === WA Cust 2: " + resWa2.customerId);

    // ------------------------------------------------------------
    // TEST 6: Concurrent Race Condition Ingestion
    // ------------------------------------------------------------
    const raceSender = "psid_race_" + runId;
    const [raceRes1, raceRes2] = await Promise.all([
      MessageHub.ingestMessage({
        businessId: tenantA.id,
        platform: "FACEBOOK",
        externalAccountId: pageA_Id,
        externalThreadId: "thread_race_" + raceSender,
        externalMessageId: "mid_race_1_" + runId,
        senderExternalId: raceSender,
        senderName: "Race Customer",
        direction: "INBOUND",
        textContent: "Concurrent Message 1",
        timestamp: new Date(),
        environment: "LIVE",
      }),
      MessageHub.ingestMessage({
        businessId: tenantA.id,
        platform: "FACEBOOK",
        externalAccountId: pageA_Id,
        externalThreadId: "thread_race_" + raceSender,
        externalMessageId: "mid_race_2_" + runId,
        senderExternalId: raceSender,
        senderName: "Race Customer",
        direction: "INBOUND",
        textContent: "Concurrent Message 2",
        timestamp: new Date(),
        environment: "LIVE",
      }),
    ]);

    const totalCustomersForRace = await prisma.customer.count({
      where: { businessId: tenantA.id, externalId: raceSender },
    });
    const raceSafe = totalCustomersForRace === 1 && raceRes1.customerId === raceRes2.customerId;
    record("18.6", "Concurrent Race Condition Ingestion (Exactly 1 Customer Created)", raceSafe, "Total Customers: " + totalCustomersForRace + ", Cust1=" + raceRes1.customerId + " === Cust2=" + raceRes2.customerId);

  } finally {
    console.log("\nCleaning up Phase 18 audit fixtures...");
    await prisma.message.deleteMany({ where: { conversation: { businessId: { in: [tenantA.id, tenantB.id] } } } });
    await prisma.conversation.deleteMany({ where: { businessId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.customerIdentityLink.deleteMany({ where: { businessId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.customer.deleteMany({ where: { businessId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.platformConnection.deleteMany({ where: { businessId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.business.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
    console.log("Phase 18 audit cleanup complete.");
  }

  console.log("\n============================================================");
  const total = assertions.length;
  const passed = assertions.filter((a) => a.passed).length;
  console.log("PHASE 18 IDENTITY OWNERSHIP AUDIT: " + passed + "/" + total + " PASSED");
  console.log("============================================================\n");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase18OwnershipAudit().catch((err) => {
  console.error("Phase 18 Audit Execution Failed:", err);
  process.exit(1);
});
