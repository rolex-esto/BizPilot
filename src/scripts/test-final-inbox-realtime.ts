/**
 * BIZPILOT — FINAL INBOX REALTIME & NEW-CUSTOMER DISCOVERY ACCEPTANCE TEST
 */

import fs from "fs";
import path from "path";

if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const idx = trimmed.indexOf("=");
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {}
}

import { prisma } from "../lib/prisma";
import { MessageHub } from "../lib/connectors/hub";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testId: string, title: string, evidence: string) {
  if (condition) {
    console.log(`${PASS} [${testId}] ${title}`);
    console.log(`   Evidence: ${evidence}`);
    passed++;
  } else {
    console.log(`${FAIL} [${testId}] ${title}`);
    console.log(`   Evidence: ${evidence}`);
    failed++;
  }
}

async function run() {
  console.log("============================================================");
  console.log("BIZPILOT — FINAL INBOX REALTIME & NEW CUSTOMER ACCEPTANCE");
  console.log("============================================================\n");

  const runId = Date.now().toString().slice(-6);
  let testBiz: any = null;

  try {
    testBiz = await prisma.business.create({
      data: {
        name: `Store Realtime ${runId}`,
        ownerName: "Owner Realtime",
        currency: "PHP",
        timezone: "Asia/Manila",
      },
    });

    const pageId = `page_${runId}`;
    const igId = `ig_${runId}`;
    const waId = `wa_${runId}`;

    await prisma.platformConnection.createMany({
      data: [
        {
          businessId: testBiz.id,
          platform: "FACEBOOK",
          platformAccountId: pageId,
          platformAccountName: "Store FB Page",
          accessTokenEncrypted: "enc_token",
          status: "CONNECTED",
        },
        {
          businessId: testBiz.id,
          platform: "INSTAGRAM",
          platformAccountId: igId,
          platformAccountName: "Store IG Account",
          accessTokenEncrypted: "enc_token",
          status: "CONNECTED",
        },
        {
          businessId: testBiz.id,
          platform: "WHATSAPP",
          platformAccountId: waId,
          platformAccountName: "Store WA Account",
          accessTokenEncrypted: "enc_token",
          status: "CONNECTED",
        },
      ],
    });

    // 1. Initial State: Establish baseline timestamp
    const t0 = new Date();
    await new Promise((r) => setTimeout(r, 100));

    // 2. Test Existing Customer Inbound Message
    const t0_msg = Date.now();
    const existingCustMsg = await MessageHub.ingestMessage({
      platform: "FACEBOOK",
      externalAccountId: pageId,
      externalMessageId: `m_exist_${runId}`,
      senderExternalId: `cust_exist_${runId}`,
      senderName: "Customer Existing",
      direction: "INBOUND",
      textContent: "Hi, do you have ThinkPad T480?",
      timestamp: new Date(),
      environment: "LIVE",
    });
    const t_persisted = Date.now();

    assert(
      Boolean(existingCustMsg.conversationId),
      "RT-1",
      "Existing Customer Message Ingested & Persisted",
      `Latency: ${t_persisted - t0_msg}ms, ConvId: ${existingCustMsg.conversationId}`
    );

    // 3. Test Active Thread Delta Query
    const safeSince = new Date(t0.getTime() - 3000);
    const deltaActiveMsgs = await prisma.message.findMany({
      where: {
        conversationId: existingCustMsg.conversationId!,
        sentAt: { gt: safeSince },
      },
      orderBy: { sentAt: "asc" },
    });

    assert(
      deltaActiveMsgs.length > 0 && deltaActiveMsgs[0].textContent.includes("ThinkPad"),
      "RT-2",
      "Active Thread Delta Query Immediately Returns New Message",
      `Messages returned: ${deltaActiveMsgs.length}, First: "${deltaActiveMsgs[0]?.textContent}"`
    );

    // 4. Test Brand New Customer Discovery via Delta Overlap
    const t_before_new = new Date();
    await new Promise((r) => setTimeout(r, 100));

    const newCustMsg = await MessageHub.ingestMessage({
      platform: "FACEBOOK",
      externalAccountId: pageId,
      externalMessageId: `m_new_${runId}`,
      senderExternalId: `cust_new_${runId}`,
      senderName: "Brand New Buyer",
      direction: "INBOUND",
      textContent: "Hello, first time buying here!",
      timestamp: new Date(),
      environment: "LIVE",
    });

    // Query conversation list delta count using safe overlap
    const safeSinceNew = new Date(t_before_new.getTime() - 3000);
    const updatedConvs = await prisma.conversation.findMany({
      where: {
        businessId: testBiz.id,
        environment: "LIVE",
        OR: [
          { updatedAt: { gt: safeSinceNew } },
          { createdAt: { gt: safeSinceNew } },
          { lastMessageAt: { gt: safeSinceNew } },
        ],
      },
      include: { customer: true, messages: { take: 1, orderBy: { sentAt: "desc" } } },
    });

    const discoveredNew = updatedConvs.find((c) => c.customer?.name === "Brand New Buyer");

    assert(
      Boolean(discoveredNew),
      "DISCOVER-1",
      "Brand New Customer Automatically Discovered via Safe Delta Query",
      `Discovered Conv: ${discoveredNew?.id}, Customer: ${discoveredNew?.customer?.name}`
    );

    // 5. Test Multi-Platform Inbound (Instagram & WhatsApp)
    const igMsg = await MessageHub.ingestMessage({
      platform: "INSTAGRAM",
      externalAccountId: igId,
      externalMessageId: `m_ig_${runId}`,
      senderExternalId: `ig_user_${runId}`,
      senderName: "IG Buyer",
      direction: "INBOUND",
      textContent: "Price check for Dell XPS 13 please",
      timestamp: new Date(),
      environment: "LIVE",
    });

    const waMsg = await MessageHub.ingestMessage({
      platform: "WHATSAPP",
      externalAccountId: waId,
      externalMessageId: `m_wa_${runId}`,
      senderExternalId: `639171234567`,
      senderName: "WA Buyer",
      direction: "INBOUND",
      textContent: "Available for SM Megamall meetup?",
      timestamp: new Date(),
      environment: "LIVE",
    });

    assert(
      Boolean(igMsg.conversationId) && Boolean(waMsg.conversationId),
      "MULTI-PLATFORM-1",
      "Multi-Platform Inbound Message Ingestion (Instagram & WhatsApp)",
      `IG Conv: ${igMsg.conversationId}, WA Conv: ${waMsg.conversationId}`
    );

  } catch (err: any) {
    console.error("Test error:", err);
    failed++;
  } finally {
    if (testBiz?.id) {
      await prisma.message.deleteMany({ where: { conversation: { businessId: testBiz.id } } });
      await prisma.conversation.deleteMany({ where: { businessId: testBiz.id } });
      await prisma.customer.deleteMany({ where: { businessId: testBiz.id } });
      await prisma.platformConnection.deleteMany({ where: { businessId: testBiz.id } });
      await prisma.business.delete({ where: { id: testBiz.id } }).catch(() => {});
    }
  }

  console.log("\n============================================================");
  console.log(`FINAL REALTIME ACCEPTANCE TESTS: ${passed}/${passed + failed} VERIFIED`);
  console.log("============================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

run();
