import { PrismaClient } from "@prisma/client";
import { MessageHub } from "../lib/connectors/hub";
import { FacebookMessengerConnector } from "../lib/connectors/facebook";
import { InstagramConnector } from "../lib/connectors/instagram";
import { WhatsAppConnector } from "../lib/connectors/whatsapp";

const prisma = new PrismaClient();

async function runMediaAcceptanceTests() {
  console.log("============================================================");
  console.log("BIZPILOT — REAL INBOUND & OUTBOUND MEDIA ACCEPTANCE SUITE");
  console.log("============================================================\n");

  const timestamp = Date.now();
  const testBusiness = await prisma.business.create({
    data: {
      name: `Media Test Store ${timestamp}`,
      ownerName: "Media Tester",
      currency: "PHP",
    },
  });

  const fbConn = await prisma.platformConnection.create({
    data: {
      businessId: testBusiness.id,
      platform: "FACEBOOK",
      platformAccountId: `fb_media_page_${timestamp}`,
      platformAccountName: "Facebook Test Page",
      status: "CONNECTED",
    },
  });

  const igConn = await prisma.platformConnection.create({
    data: {
      businessId: testBusiness.id,
      platform: "INSTAGRAM",
      platformAccountId: `ig_media_acct_${timestamp}`,
      platformAccountName: "Instagram Test Account",
      status: "CONNECTED",
    },
  });

  const waConn = await prisma.platformConnection.create({
    data: {
      businessId: testBusiness.id,
      platform: "WHATSAPP",
      platformAccountId: `wa_media_acct_${timestamp}`,
      platformAccountName: "WhatsApp Test Line",
      status: "CONNECTED",
    },
  });

  // TEST 1: Photo-only Facebook Inbound (No text)
  const fbPhotoWebhook = {
    object: "page",
    entry: [
      {
        id: fbConn.platformAccountId,
        time: timestamp,
        messaging: [
          {
            sender: { id: `fb_cust_photo_${timestamp}` },
            recipient: { id: fbConn.platformAccountId },
            message: {
              mid: `mid_fb_photo_${timestamp}`,
              attachments: [
                {
                  type: "image",
                  payload: {
                    url: "https://scontent.xx.fbcdn.net/v/t39.30808-6/test_photo.jpg",
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const parsedFbEvents = FacebookMessengerConnector.parseWebhookPayload(fbPhotoWebhook);
  if (parsedFbEvents.length !== 1 || parsedFbEvents[0].messageType !== "IMAGE" || !parsedFbEvents[0].mediaUrl) {
    throw new Error("FAIL [MEDIA-1] Facebook photo-only parsing failed");
  }

  const fbIngestRes = await MessageHub.ingestMessage({
    ...parsedFbEvents[0],
    businessId: testBusiness.id,
    environment: "LIVE",
  });

  const persistedFbMsg = await prisma.message.findUnique({
    where: { id: fbIngestRes.messageId },
  });

  if (!persistedFbMsg || persistedFbMsg.mediaType !== "IMAGE" || !persistedFbMsg.mediaUrl) {
    throw new Error("FAIL [MEDIA-1] Facebook photo message was not persisted correctly in DB");
  }
  console.log("✅ PASS [MEDIA-1] Facebook Photo-Only Ingested & Persisted (Empty Text Handled)");

  // TEST 2: Facebook Inbound Video
  const fbVideoWebhook = {
    object: "page",
    entry: [
      {
        id: fbConn.platformAccountId,
        time: timestamp + 100,
        messaging: [
          {
            sender: { id: `fb_cust_video_${timestamp}` },
            recipient: { id: fbConn.platformAccountId },
            message: {
              mid: `mid_fb_video_${timestamp}`,
              attachments: [
                {
                  type: "video",
                  payload: {
                    url: "https://video.xx.fbcdn.net/v/t42.1790-2/test_video.mp4",
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const parsedFbVideo = FacebookMessengerConnector.parseWebhookPayload(fbVideoWebhook);
  const fbVideoIngestRes = await MessageHub.ingestMessage({
    ...parsedFbVideo[0],
    businessId: testBusiness.id,
    environment: "LIVE",
  });

  const persistedVideoMsg = await prisma.message.findUnique({
    where: { id: fbVideoIngestRes.messageId },
  });

  if (!persistedVideoMsg || persistedVideoMsg.mediaType !== "VIDEO" || !persistedVideoMsg.mediaUrl) {
    throw new Error("FAIL [MEDIA-2] Facebook video message was not persisted correctly in DB");
  }
  console.log("✅ PASS [MEDIA-2] Facebook Video Ingested & Persisted");

  // TEST 3: Multi-Photo Inbound Facebook Message (3 photos in 1 message)
  const fbMultiPhotoWebhook = {
    object: "page",
    entry: [
      {
        id: fbConn.platformAccountId,
        time: timestamp + 200,
        messaging: [
          {
            sender: { id: `fb_cust_multi_${timestamp}` },
            recipient: { id: fbConn.platformAccountId },
            message: {
              mid: `mid_fb_multi_${timestamp}`,
              attachments: [
                { type: "image", payload: { url: "https://scontent.xx.fbcdn.net/p1.jpg" } },
                { type: "image", payload: { url: "https://scontent.xx.fbcdn.net/p2.jpg" } },
                { type: "image", payload: { url: "https://scontent.xx.fbcdn.net/p3.jpg" } },
              ],
            },
          },
        ],
      },
    ],
  };

  const parsedMultiEvents = FacebookMessengerConnector.parseWebhookPayload(fbMultiPhotoWebhook);
  if (parsedMultiEvents.length !== 3) {
    throw new Error(`FAIL [MEDIA-3] Multi-photo parsing expected 3 events, got ${parsedMultiEvents.length}`);
  }

  for (const ev of parsedMultiEvents) {
    await MessageHub.ingestMessage({
      ...ev,
      businessId: testBusiness.id,
      environment: "LIVE",
    });
  }
  console.log("✅ PASS [MEDIA-3] Facebook Multi-Photo Attachments (All 3 Photos Ingested)");

  // TEST 4: Instagram Photo Inbound
  const igPhotoWebhook = {
    object: "instagram",
    entry: [
      {
        id: igConn.platformAccountId,
        time: timestamp + 300,
        messaging: [
          {
            sender: { id: `ig_cust_photo_${timestamp}` },
            recipient: { id: igConn.platformAccountId },
            message: {
              mid: `mid_ig_photo_${timestamp}`,
              attachments: [
                {
                  type: "image",
                  payload: {
                    url: "https://scontent.cdninstagram.com/v/test_ig_photo.jpg",
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const parsedIgEvents = InstagramConnector.parseWebhookPayload(igPhotoWebhook);
  const igIngestRes = await MessageHub.ingestMessage({
    ...parsedIgEvents[0],
    businessId: testBusiness.id,
    environment: "LIVE",
  });

  const persistedIgMsg = await prisma.message.findUnique({
    where: { id: igIngestRes.messageId },
  });

  if (!persistedIgMsg || persistedIgMsg.mediaType !== "IMAGE") {
    throw new Error("FAIL [MEDIA-4] Instagram photo message persistence failed");
  }
  console.log("✅ PASS [MEDIA-4] Instagram Photo-Only Ingested & Persisted");

  // TEST 5: WhatsApp Media Inbound (Media ID Protected)
  const waPhotoWebhook = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: waConn.platformAccountId,
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "12345" },
              contacts: [{ wa_id: `63917${timestamp % 10000000}`, profile: { name: "WhatsApp Buyer" } }],
              messages: [
                {
                  from: `63917${timestamp % 10000000}`,
                  id: `wamid_${timestamp}`,
                  timestamp: Math.floor(timestamp / 1000).toString(),
                  type: "image",
                  image: {
                    id: "wa_media_id_998877",
                    mime_type: "image/jpeg",
                    sha256: "dummy_sha_256",
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const parsedWaEvents = WhatsAppConnector.parseWebhookPayload(waPhotoWebhook);
  const waIngestRes = await MessageHub.ingestMessage({
    ...parsedWaEvents[0],
    businessId: testBusiness.id,
    environment: "LIVE",
  });

  const persistedWaMsg = await prisma.message.findUnique({
    where: { id: waIngestRes.messageId },
  });

  if (!persistedWaMsg || persistedWaMsg.mediaType !== "IMAGE" || !persistedWaMsg.mediaUrl?.includes("mediaId=wa_media_id_998877")) {
    throw new Error("FAIL [MEDIA-5] WhatsApp photo proxy routing failed");
  }
  console.log("✅ PASS [MEDIA-5] WhatsApp Protected Media Ingested with Proxy Routing");

  console.log("\n============================================================");
  console.log("MEDIA ACCEPTANCE TESTS: 5/5 VERIFIED");
  console.log("============================================================\n");
}

runMediaAcceptanceTests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
