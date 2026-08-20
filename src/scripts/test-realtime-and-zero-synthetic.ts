import { prisma } from "../lib/prisma";
import { MessageHub } from "../lib/connectors/hub";
import { FacebookMessengerConnector } from "../lib/connectors/facebook";
import { InstagramConnector } from "../lib/connectors/instagram";
import { WhatsAppConnector } from "../lib/connectors/whatsapp";
import { verifyMetaSignature, generateMetaSignature } from "../lib/connectors/security";
import { RealtimeBroadcaster, RealtimeMessageEvent } from "../lib/realtime/broadcaster";

interface TestResult {
  id: string;
  title: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function record(id: string, title: string, passed: boolean, details?: string, error?: string) {
  results.push({ id, title, passed, details, error });
  const mark = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${mark} [${id}] ${title} ${details ? "— " + details : ""}`);
  if (error) console.error(`   Error: ${error}`);
}

async function runRealtimeAndZeroSyntheticAudit() {
  console.log("============================================================");
  console.log("BIZPILOT — REAL-TIME INBOX & ZERO-SYNTHETIC FORENSIC SUITE");
  console.log("============================================================\n");

  const runId = Date.now();
  const secret = "audit_meta_secret_2026";

  const bizA = await prisma.business.create({
    data: {
      name: "Store A (" + runId + ")",
      ownerName: "Alice Santos",
      email: "alice_" + runId + "@bizpilot.ph",
      currency: "PHP",
    },
  });

  const bizB = await prisma.business.create({
    data: {
      name: "Store B (" + runId + ")",
      ownerName: "Bob Tan",
      email: "bob_" + runId + "@bizpilot.ph",
      currency: "PHP",
    },
  });

  const pageIdA = "fb_page_a_" + runId;
  const pageIdB = "fb_page_b_" + runId;

  await prisma.platformConnection.create({
    data: {
      businessId: bizA.id,
      platform: "FACEBOOK",
      platformAccountId: pageIdA,
      platformAccountName: "Store A Official FB",
      status: "CONNECTED",
    },
  });

  await prisma.platformConnection.create({
    data: {
      businessId: bizB.id,
      platform: "FACEBOOK",
      platformAccountId: pageIdB,
      platformAccountName: "Store B Official FB",
      status: "CONNECTED",
    },
  });

  try {
    // 1. EVENT-DRIVEN REALTIME BROADCASTER & TENANT ISOLATION
    const receivedEventsBizA: RealtimeMessageEvent[] = [];
    const receivedEventsBizB: RealtimeMessageEvent[] = [];

    const unsubA = RealtimeBroadcaster.subscribe(bizA.id, (ev) => {
      receivedEventsBizA.push(ev);
    });
    const unsubB = RealtimeBroadcaster.subscribe(bizB.id, (ev) => {
      receivedEventsBizB.push(ev);
    });

    RealtimeBroadcaster.broadcast({
      type: "message.created",
      businessId: bizA.id,
      conversationId: "conv_test_a",
      platform: "FACEBOOK",
      environment: "LIVE",
      preview: "Hello Store A",
    });

    const realtimeIsolated = receivedEventsBizA.length === 1 && receivedEventsBizB.length === 0;
    record("RT-1", "Realtime Event Broadcaster Multi-Tenant Partitioning (Biz A sees 1, Biz B sees 0)", realtimeIsolated, "Biz A events: " + receivedEventsBizA.length + ", Biz B events: " + receivedEventsBizB.length);
    unsubA();
    unsubB();

    // 2. NEGATIVE TEST 5: INVALID WEBHOOK SIGNATURE REJECTION
    const payloadBody = JSON.stringify({ object: "page", entry: [] });
    const badSignature = "sha256=0000000000000000000000000000000000000000000000000000000000000000";
    const isBadSigValid = verifyMetaSignature(payloadBody, badSignature, secret);
    record("NEG-5", "Negative Test 5: Invalid Webhook HMAC-SHA256 Signature Rejected", !isBadSigValid, "Cryptographic validation correctly returned false");

    // 3. NEGATIVE TEST 6: UNREGISTERED ACCOUNT REJECTION (No findFirst fallback)
    let rejectedUnknownAccount = false;
    try {
      await MessageHub.ingestMessage({
        platform: "FACEBOOK",
        externalAccountId: "unregistered_page_id_999999",
        externalThreadId: "thread_999",
        externalMessageId: "msg_unknown_" + runId,
        senderExternalId: "psid_stranger",
        direction: "INBOUND",
        textContent: "Hello to unknown page",
        timestamp: new Date(),
      });
    } catch (err: any) {
      rejectedUnknownAccount = err.message.includes("Routing rejected");
    }
    record("NEG-6", "Negative Test 6: Unregistered Webhook Account Safely Rejected (Zero Silent findFirst Fallback)", rejectedUnknownAccount, "Error: Routing rejected (No registered business/connection)");

    // 4. NEGATIVE TEST 7: DUPLICATE WEBHOOK IDEMPOTENCY
    const dupMsgId = "dup_msg_" + runId;
    const validEvent = {
      businessId: bizA.id,
      platform: "FACEBOOK" as const,
      externalAccountId: pageIdA,
      externalThreadId: "thread_dup_test",
      externalMessageId: dupMsgId,
      senderExternalId: "psid_dup_tester",
      direction: "INBOUND" as const,
      textContent: "Testing duplicate protection",
      timestamp: new Date(),
    };

    const res1 = await MessageHub.ingestMessage(validEvent);
    const res2 = await MessageHub.ingestMessage(validEvent);
    const res3 = await MessageHub.ingestMessage(validEvent);

    const dupCount = await prisma.message.count({ where: { externalMessageId: dupMsgId } });
    const dupPass = res1.isDuplicate === false && res2.isDuplicate === true && res3.isDuplicate === true && dupCount === 1;
    record("NEG-7", "Negative Test 7: Duplicate Webhook Protection (3 identical deliveries -> Exactly 1 Message in DB)", dupPass, "DB Count: " + dupCount);

    // 5. NEGATIVE TEST 8: TRUTHFUL IDENTITY FALLBACK (Zero Fabricated Names)
    const anonSenderId = "3778929104";
    const anonMsgId = "msg_anon_" + runId;
    const anonRes = await MessageHub.ingestMessage({
      businessId: bizA.id,
      platform: "FACEBOOK",
      externalAccountId: pageIdA,
      externalThreadId: "thread_anon",
      externalMessageId: anonMsgId,
      senderExternalId: anonSenderId,
      direction: "INBOUND",
      textContent: "Magkano po?",
      timestamp: new Date(),
    });

    const anonCust = await prisma.customer.findUnique({ where: { id: anonRes.customerId! } });
    const truthfulName = anonCust?.name === "Facebook User (377892)";
    record("NEG-8", "Negative Test 8: Truthful Identity Fallback (Generated Facebook User 377892 / Zero Fake Customer Alpha)", truthfulName, "Customer Name: " + anonCust?.name);

    // 6. WHATSAPP & INSTAGRAM CONNECTOR NORMALIZATION
    const waPayload = {
      object: "whatsapp_business_account",
      entry: [{
        id: "waba_123",
        changes: [{
          value: {
            metadata: { phone_number_id: "phone_456", display_phone_number: "+639171234567" },
            contacts: [{ profile: { name: "Marco Santos" }, wa_id: "639171234567" }],
            messages: [{ from: "639171234567", id: "wamid_test_" + runId, timestamp: "1700000000", text: { body: "Inquire po ako" }, type: "text" }]
          }
        }]
      }]
    };
    const waEvents = WhatsAppConnector.parseWebhookPayload(waPayload);
    const waOk = waEvents.length === 1 && waEvents[0].senderName === "Marco Santos" && waEvents[0].senderPhone === "+639171234567";
    record("NORM-1", "WhatsApp Cloud API Webhook Normalization (Contact Profile: Marco Santos)", waOk, "Sender: " + waEvents[0]?.senderName + ", Phone: " + waEvents[0]?.senderPhone);

  } finally {
    console.log("\nCleaning up audit fixtures...");
    await prisma.message.deleteMany({ where: { conversation: { businessId: { in: [bizA.id, bizB.id] } } } });
    await prisma.conversation.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
    await prisma.customerIdentityLink.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
    await prisma.customer.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
    await prisma.platformConnection.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
    await prisma.business.deleteMany({ where: { id: { in: [bizA.id, bizB.id] } } });
    console.log("Audit fixture cleanup complete.");
  }

  console.log("\n============================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log("REAL-TIME & ZERO-SYNTHETIC AUDIT: " + passed + "/" + total + " VERIFIED");
  console.log("============================================================\n");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runRealtimeAndZeroSyntheticAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
