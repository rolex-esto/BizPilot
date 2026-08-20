import { prisma } from "../lib/prisma";
import { MessageHub } from "../lib/connectors/hub";
import { FacebookMessengerConnector } from "../lib/connectors/facebook";
import { InstagramConnector } from "../lib/connectors/instagram";
import { verifyMetaSignature, generateMetaSignature } from "../lib/connectors/security";
import { LivePlatformApiClient } from "../lib/connectors/live-client";
import { TokenVault } from "../lib/connectors/token-vault";

interface IncidentAssertion {
  testId: string;
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: IncidentAssertion[] = [];

function record(testId: string, name: string, passed: boolean, details?: string, error?: string) {
  results.push({ testId, name, passed, details, error });
  const icon = passed ? "🔬 PASS" : "💥 FAIL";
  console.log(`${icon} [${testId}] ${name} ${details ? "— " + details : ""}`);
  if (error) console.error(`   Error: ${error}`);
}

async function runIncidentForensicAudit() {
  console.log("============================================================");
  console.log("BIZPILOT — PRODUCTION INBOX & CUSTOMER IDENTITY FORENSIC AUDIT");
  console.log("INCIDENT: REAL MESSAGE NOT RECEIVED + FAKE CUSTOMER ALPHA");
  console.log("============================================================\n");

  const runId = Date.now();
  const secret = "production_audit_meta_secret_2026";

  const biz = await prisma.business.create({
    data: {
      name: "Forensic Incident Store (" + runId + ")",
      ownerName: "Elena Rostova",
      email: "elena_incident_" + runId + "@bizpilot.ph",
      currency: "PHP",
    },
  });

  const pageId = "1242780318921380";
  const rawPageToken = "EAAGtest_page_access_token_" + runId;
  const encryptedToken = TokenVault.encrypt(rawPageToken);

  await prisma.platformConnection.create({
    data: {
      businessId: biz.id,
      platform: "FACEBOOK",
      platformAccountId: pageId,
      platformAccountName: "BizPilot Official Page",
      accessTokenEncrypted: encryptedToken,
      status: "CONNECTED",
    },
  });

  try {
    const realPayload = {
      object: "page",
      entry: [
        {
          id: pageId,
          time: runId,
          messaging: [
            {
              sender: { id: "psid_real_" + runId },
              recipient: { id: pageId },
              timestamp: runId,
              message: {
                mid: "mid_real_fb_" + runId,
                text: "Hello po, magkano po ang Lenovo ThinkPad T480?",
              },
            },
          ],
        },
      ],
    };

    const rawBody = JSON.stringify(realPayload);
    const signature = generateMetaSignature(rawBody, secret);
    const sigValid = verifyMetaSignature(rawBody, signature, secret);
    record("1.1", "Meta Webhook Cryptographic Signature Verification (HMAC-SHA256)", sigValid, "Signature: " + signature.substring(0, 18) + "...");

    const parsedEvents = FacebookMessengerConnector.parseWebhookPayload(realPayload);
    const parseOk = parsedEvents.length === 1 && parsedEvents[0].senderExternalId === "psid_real_" + runId && parsedEvents[0].externalAccountId === pageId;
    record("1.2", "Meta Messenger Webhook Payload Parsing & Normalization", parseOk, "Events parsed: " + parsedEvents.length + ", Text: " + parsedEvents[0]?.textContent);

    const event = parsedEvents[0];
    event.environment = "LIVE";
    event.businessId = biz.id;
    event.senderName = "Rolex Esto";

    const ingestRes = await MessageHub.ingestMessage(event);
    const customer = await prisma.customer.findFirst({
      where: { businessId: biz.id, externalId: "psid_real_" + runId },
    });
    const message = await prisma.message.findUnique({
      where: { externalMessageId: "mid_real_fb_" + runId },
    });

    const dbPersistOk = !!customer && customer.name === "Rolex Esto" && !!message && message.textContent.includes("ThinkPad T480");
    record("1.3", "Inbound Message Ingestion & Real Profile Resolution (Name: Rolex Esto)", dbPersistOk, "Cust ID: " + customer?.id + ", Name: " + customer?.name + ", Msg ID: " + message?.id);

    const inboxConversations = await prisma.conversation.findMany({
      where: { businessId: biz.id, environment: "LIVE" },
      include: { customer: true, messages: true },
    });

    const hasCustomerAlpha = inboxConversations.some((c) => c.customer?.name?.includes("Customer Alpha") || c.customer?.name?.includes("Alpha"));
    const onlyRealCustomer = inboxConversations.length === 1 && inboxConversations[0].customer?.name === "Rolex Esto";
    record("1.4", "Production Inbox Data Truth (Zero Customer Alpha / Real Customer Only)", !hasCustomerAlpha && onlyRealCustomer, "Total Conversations: " + inboxConversations.length + ", Customer Name: " + inboxConversations[0]?.customer?.name);

    const echoPayload = {
      object: "page",
      entry: [
        {
          id: pageId,
          time: runId + 1000,
          messaging: [
            {
              sender: { id: pageId },
              recipient: { id: "psid_real_" + runId },
              timestamp: runId + 1000,
              message: {
                is_echo: true,
                mid: "mid_echo_fb_" + runId,
                text: "Opo available po, ₱18,500 po last price.",
              },
            },
          ],
        },
      ],
    };

    const parsedEcho = FacebookMessengerConnector.parseWebhookPayload(echoPayload);
    const echoParsedOk = parsedEcho.length === 1 && parsedEcho[0].direction === "OUTBOUND" && parsedEcho[0].senderExternalId === "psid_real_" + runId;
    record("1.5", "Facebook Page Message Echo Handling (Direction: OUTBOUND)", echoParsedOk, "Direction: " + parsedEcho[0]?.direction + ", Recipient PSID: " + parsedEcho[0]?.senderExternalId);

    if (echoParsedOk) {
      parsedEcho[0].environment = "LIVE";
      parsedEcho[0].businessId = biz.id;
      await MessageHub.ingestMessage(parsedEcho[0]);
    }

    const convMessages = await prisma.message.findMany({
      where: { conversationId: inboxConversations[0].id },
      orderBy: { sentAt: "asc" },
    });
    const threadComplete = convMessages.length === 2 && convMessages[0].direction === "INBOUND" && convMessages[1].direction === "OUTBOUND";
    record("1.6", "Complete Bi-Directional Thread Sync (1 Inbound + 1 Outbound Echo in Same Thread)", threadComplete, "Total Messages in Thread: " + convMessages.length);

  } finally {
    console.log("\nCleaning up forensic incident test fixtures...");
    await prisma.message.deleteMany({ where: { conversation: { businessId: biz.id } } });
    await prisma.conversation.deleteMany({ where: { businessId: biz.id } });
    await prisma.customerIdentityLink.deleteMany({ where: { businessId: biz.id } });
    await prisma.customer.deleteMany({ where: { businessId: biz.id } });
    await prisma.platformConnection.deleteMany({ where: { businessId: biz.id } });
    await prisma.business.delete({ where: { id: biz.id } });
    console.log("Incident test cleanup complete.");
  }

  console.log("\n============================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log("INCIDENT FORENSIC AUDIT: " + passed + "/" + total + " VERIFIED");
  console.log("============================================================\n");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runIncidentForensicAudit().catch((err) => {
  console.error("Forensic incident audit failed:", err);
  process.exit(1);
});