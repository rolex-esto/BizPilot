import { prisma } from "../lib/prisma";
import { MessageHub } from "../lib/connectors/hub";
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

async function runMultiCustomerAutoSyncTest() {
  console.log("============================================================");
  console.log("BIZPILOT — MULTI-CUSTOMER AUTO-SYNC & THREAD ISOLATION TEST");
  console.log("============================================================\n");

  const runId = Date.now();
  const pageId = "page_multi_" + runId;

  const biz = await prisma.business.create({
    data: {
      name: "Multi-Customer Store (" + runId + ")",
      ownerName: "Maria Store Owner",
      email: "maria_multi_" + runId + "@bizpilot.ph",
      currency: "PHP",
    },
  });

  await prisma.platformConnection.create({
    data: {
      businessId: biz.id,
      platform: "FACEBOOK",
      platformAccountId: pageId,
      platformAccountName: "Official FB Page",
      status: "CONNECTED",
    },
  });

  try {
    const custAPsid = "psid_cust_a_" + runId;
    const custBPsid = "psid_cust_b_" + runId;
    const custCPsid = "psid_cust_c_" + runId;

    const eventsToStream = [
      { sender: custAPsid, name: "Customer A (Juan)", text: "A1: Magkano po ang Lenovo T480?", time: 1000 },
      { sender: custBPsid, name: "Customer B (Maria)", text: "B1: Available pa po ba yung ThinkPad?", time: 2000 },
      { sender: custAPsid, name: "Customer A (Juan)", text: "A2: May kasama po bang charger?", time: 3000 },
      { sender: custCPsid, name: "Customer C (Pedro)", text: "C1: Pwede po ba meetup sa Megamall?", time: 4000 },
      { sender: custBPsid, name: "Customer B (Maria)", text: "B2: Kukunin ko na po via GCash.", time: 5000 },
      { sender: custAPsid, name: "Customer A (Juan)", text: "A3: Sige po, pick-upin ko bukas.", time: 6000 },
    ];

    const receivedRealtimeEvents: RealtimeMessageEvent[] = [];
    const unsub = RealtimeBroadcaster.subscribe(biz.id, (ev) => {
      receivedRealtimeEvents.push(ev);
    }, "LIVE");

    for (let idx = 0; idx < eventsToStream.length; idx++) {
      const item = eventsToStream[idx];
      await MessageHub.ingestMessage({
        businessId: biz.id,
        platform: "FACEBOOK",
        externalAccountId: pageId,
        externalThreadId: "thread_" + item.sender,
        externalMessageId: `msg_${runId}_${idx}`,
        senderExternalId: item.sender,
        senderName: item.name,
        direction: "INBOUND",
        textContent: item.text,
        environment: "LIVE",
        sourceType: "FACEBOOK",
        timestamp: new Date(runId + item.time),
      });
    }

    unsub();

    // 1. Verify 3 Distinct Conversations Created
    const allConvs = await prisma.conversation.findMany({
      where: { businessId: biz.id, environment: "LIVE" },
      include: { customer: true, messages: { orderBy: { sentAt: "asc" } } },
    });

    record("MULTI-1", "Multi-Customer Ingestion (3 Distinct Conversations Created)", allConvs.length === 3, `Found ${allConvs.length} conversations`);

    // 2. Verify Thread Isolation: A has 3 msgs, B has 2 msgs, C has 1 msg
    const convA = allConvs.find(c => c.customer.externalId === custAPsid);
    const convB = allConvs.find(c => c.customer.externalId === custBPsid);
    const convC = allConvs.find(c => c.customer.externalId === custCPsid);

    const countA = convA?.messages.length || 0;
    const countB = convB?.messages.length || 0;
    const countC = convC?.messages.length || 0;

    const threadIsolation = countA === 3 && countB === 2 && countC === 1;
    record("MULTI-2", "Strict Thread Isolation (A has 3 msgs, B has 2 msgs, C has 1 msg)", threadIsolation,
      `Counts: A=${countA}, B=${countB}, C=${countC}`);

    // 3. Verify Message Content Quarantined to Respective Threads
    const aHasBOrC = convA?.messages.some(m => m.textContent.startsWith("B") || m.textContent.startsWith("C"));
    const bHasAOrC = convB?.messages.some(m => m.textContent.startsWith("A") || m.textContent.startsWith("C"));
    const cHasAOrB = convC?.messages.some(m => m.textContent.startsWith("A") || m.textContent.startsWith("B"));

    const contentQuarantine = !aHasBOrC && !bHasAOrC && !cHasAOrB;
    record("MULTI-3", "Zero Cross-Thread Message Contamination", contentQuarantine,
      `A contaminated: ${aHasBOrC}, B contaminated: ${bHasAOrC}, C contaminated: ${cHasAOrB}`);

    // 4. Verify Realtime Event Stream Delivery (6 events dispatched in sequence)
    const realtimeCount = receivedRealtimeEvents.length === 6;
    record("MULTI-4", "Realtime Event Dispatch (6 sequential events received via Broadcaster)", realtimeCount,
      `Received ${receivedRealtimeEvents.length} events`);

  } finally {
    console.log("\nCleaning up multi-customer test fixtures...");
    await prisma.message.deleteMany({ where: { conversation: { businessId: biz.id } } });
    await prisma.conversation.deleteMany({ where: { businessId: biz.id } });
    await prisma.customerIdentityLink.deleteMany({ where: { businessId: biz.id } });
    await prisma.customer.deleteMany({ where: { businessId: biz.id } });
    await prisma.platformConnection.deleteMany({ where: { businessId: biz.id } });
    await prisma.business.delete({ where: { id: biz.id } });
    console.log("Multi-customer test cleanup complete.");
  }

  console.log("\n============================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`MULTI-CUSTOMER AUTO-SYNC AUDIT: ${passed}/${total} VERIFIED`);
  console.log("============================================================\n");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runMultiCustomerAutoSyncTest().catch((err) => {
  console.error("Multi-customer test error:", err);
  process.exit(1);
});