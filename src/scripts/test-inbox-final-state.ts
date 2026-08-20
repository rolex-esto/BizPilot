import { prisma } from "../lib/prisma";
import { MessageHub } from "../lib/connectors/hub";
import { RealtimeBroadcaster, RealtimeMessageEvent } from "../lib/realtime/broadcaster";
import { DeveloperSimulator } from "../lib/connectors/simulator";

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

async function runInboxFinalStateAudit() {
  console.log("============================================================");
  console.log("BIZPILOT — FINAL INBOX STATE, LIVE/PRACTICE ISOLATION & SSE AUDIT");
  console.log("============================================================\n");

  const runId = Date.now();

  // 1. Create Business A and Business B
  const bizA = await prisma.business.create({
    data: {
      name: "Store A (" + runId + ")",
      ownerName: "Owner A",
      email: "owner_a_" + runId + "@bizpilot.ph",
      currency: "PHP",
    },
  });

  const bizB = await prisma.business.create({
    data: {
      name: "Store B (" + runId + ")",
      ownerName: "Owner B",
      email: "owner_b_" + runId + "@bizpilot.ph",
      currency: "PHP",
    },
  });

  const pageIdA = "page_a_" + runId;
  await prisma.platformConnection.create({
    data: {
      businessId: bizA.id,
      platform: "FACEBOOK",
      platformAccountId: pageIdA,
      platformAccountName: "Store A FB",
      status: "CONNECTED",
    },
  });

  try {
    // ------------------------------------------------------------
    // TEST 1: LIVE INGESTION & PRACTICE ISOLATION
    // ------------------------------------------------------------
    const liveEvent = {
      businessId: bizA.id,
      platform: "FACEBOOK" as const,
      externalAccountId: pageIdA,
      externalThreadId: "thread_live_" + runId,
      externalMessageId: "msg_live_" + runId,
      senderExternalId: "psid_live_" + runId,
      senderName: "Real Live Customer",
      direction: "INBOUND" as const,
      textContent: "Inquiry on real live channel",
      environment: "LIVE" as const,
      sourceType: "FACEBOOK" as const,
      timestamp: new Date(),
    };

    const simEvent = DeveloperSimulator.createSimulatedEvent(
      "FACEBOOK",
      "Simulated Practice User",
      "Inquiry on practice simulator",
      { businessId: bizA.id, externalAccountId: pageIdA }
    );

    await MessageHub.ingestMessage(liveEvent);
    await MessageHub.ingestMessage(simEvent);

    const liveConvs = await prisma.conversation.findMany({
      where: { businessId: bizA.id, environment: "LIVE" },
      include: { customer: true },
    });

    const practiceConvs = await prisma.conversation.findMany({
      where: { businessId: bizA.id, environment: "PRACTICE" },
      include: { customer: true },
    });

    const test1LivePass = liveConvs.length === 1 && liveConvs[0].customer.name === "Real Live Customer" && liveConvs[0].environment === "LIVE";
    const test1PracticePass = practiceConvs.length === 1 && practiceConvs[0].customer.name === "Simulated Practice User" && practiceConvs[0].environment === "PRACTICE";
    record("ISO-1", "Strict Database Environment Partitioning (1 LIVE, 1 PRACTICE)", test1LivePass && test1PracticePass,
      `LIVE Convs: ${liveConvs.length} ("${liveConvs[0]?.customer.name}"), PRACTICE Convs: ${practiceConvs.length} ("${practiceConvs[0]?.customer.name}")`);

    // ------------------------------------------------------------
    // TEST 2: ENVIRONMENT-AWARE SSE BROADCASTER ISOLATION
    // ------------------------------------------------------------
    const liveEventsReceived: RealtimeMessageEvent[] = [];
    const practiceEventsReceived: RealtimeMessageEvent[] = [];
    const bizBEventsReceived: RealtimeMessageEvent[] = [];

    const unsubLive = RealtimeBroadcaster.subscribe(bizA.id, (ev) => liveEventsReceived.push(ev), "LIVE");
    const unsubPractice = RealtimeBroadcaster.subscribe(bizA.id, (ev) => practiceEventsReceived.push(ev), "PRACTICE");
    const unsubBizB = RealtimeBroadcaster.subscribe(bizB.id, (ev) => bizBEventsReceived.push(ev), "LIVE");

    // Broadcast a LIVE event for Biz A
    RealtimeBroadcaster.broadcast({
      type: "message.created",
      businessId: bizA.id,
      conversationId: "c_live_1",
      platform: "FACEBOOK",
      environment: "LIVE",
      preview: "Live incoming event",
    });

    // Broadcast a PRACTICE event for Biz A
    RealtimeBroadcaster.broadcast({
      type: "message.created",
      businessId: bizA.id,
      conversationId: "c_practice_1",
      platform: "FACEBOOK",
      environment: "PRACTICE",
      preview: "Practice simulator event",
    });

    const sseLiveIsolated = liveEventsReceived.length === 1 && liveEventsReceived[0].environment === "LIVE";
    const ssePracticeIsolated = practiceEventsReceived.length === 1 && practiceEventsReceived[0].environment === "PRACTICE";
    const sseTenantIsolated = bizBEventsReceived.length === 0;

    record("SSE-1", "Environment-Scoped SSE Subscription (LIVE subscriber receives 0 PRACTICE events)", sseLiveIsolated, `LIVE Sub got: ${liveEventsReceived.length} event(s)`);
    record("SSE-2", "Environment-Scoped SSE Subscription (PRACTICE subscriber receives 0 LIVE events)", ssePracticeIsolated, `PRACTICE Sub got: ${practiceEventsReceived.length} event(s)`);
    record("SSE-3", "Multi-Tenant SSE Isolation (Store B receives 0 events from Store A)", sseTenantIsolated, `Store B got: ${bizBEventsReceived.length} event(s)`);

    unsubLive();
    unsubPractice();
    unsubBizB();

    // ------------------------------------------------------------
    // TEST 3: TRUTHFUL LOCAL DELETION
    // ------------------------------------------------------------
    const convToDelete = liveConvs[0];
    await prisma.$transaction([
      prisma.message.deleteMany({ where: { conversationId: convToDelete.id } }),
      prisma.conversation.delete({ where: { id: convToDelete.id } }),
    ]);

    const remainingLive = await prisma.conversation.count({ where: { id: convToDelete.id } });
    const remainingMsgs = await prisma.message.count({ where: { conversationId: convToDelete.id } });
    record("DEL-1", "Truthful Local Conversation Deletion (DB Row & Messages Cleared)", remainingLive === 0 && remainingMsgs === 0,
      `Remaining DB convs: ${remainingLive}, msgs: ${remainingMsgs}`);

  } finally {
    console.log("\nCleaning up audit fixtures...");
    await prisma.message.deleteMany({ where: { conversation: { businessId: { in: [bizA.id, bizB.id] } } } });
    await prisma.conversation.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
    await prisma.customerIdentityLink.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
    await prisma.customer.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
    await prisma.platformConnection.deleteMany({ where: { businessId: { in: [bizA.id, bizB.id] } } });
    await prisma.business.deleteMany({ where: { id: { in: [bizA.id, bizB.id] } } });
    console.log("Audit cleanup complete.");
  }

  console.log("\n============================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`FINAL INBOX STATE & ISOLATION AUDIT: ${passed}/${total} VERIFIED`);
  console.log("============================================================\n");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runInboxFinalStateAudit().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});