import { NextRequest, NextResponse } from "next/server";
import { verifyMetaSignature, verifyMetaWebhookHandshake } from "@/lib/connectors/security";
import { FacebookMessengerConnector } from "@/lib/connectors/facebook";
import { InstagramConnector } from "@/lib/connectors/instagram";
import { MessageHub } from "@/lib/connectors/hub";

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "mtb_fb_verify_token_2026";
const META_APP_SECRET = process.env.META_APP_SECRET || "development_meta_app_secret";

/**
 * GET Handler: Meta Webhook Challenge Handshake
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log(`[FACEBOOK][WEBHOOK] method=GET mode=${mode} tokenMatch=${token === META_VERIFY_TOKEN}`);

  const result = verifyMetaWebhookHandshake(mode, token, challenge, META_VERIFY_TOKEN);

  if (result.isValid && result.challenge) {
    console.log(`[FACEBOOK][WEBHOOK] GET Challenge verified successfully.`);
    return new NextResponse(result.challenge, { status: 200 });
  }

  console.log(`[FACEBOOK][WEBHOOK] GET Challenge failed: token mismatch.`);
  return new NextResponse("Forbidden: Webhook verification token mismatch", { status: 403 });
}

/**
 * POST Handler: Meta Webhook Ingestion (Facebook Messenger & Instagram)
 */
export async function POST(req: NextRequest) {
  console.log(`[FACEBOOK][WEBHOOK] method=POST received=true`);
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");

    console.log(`[FACEBOOK][WEBHOOK] signaturePresent=${Boolean(signature)}`);

    // Enforce HMAC signature verification whenever signature header is provided,
    // or when running in production/staging environment.
    const isProductionOrStaging = process.env.NODE_ENV === "production" || process.env.APP_ENV === "staging";
    if (signature || isProductionOrStaging) {
      if (!signature) {
        console.log(`[FACEBOOK][WEBHOOK] signatureValid=false (Missing signature header)`);
        return NextResponse.json({ error: "Missing x-hub-signature-256 header" }, { status: 401 });
      }
      const isValid = verifyMetaSignature(rawBody, signature, META_APP_SECRET);
      console.log(`[FACEBOOK][WEBHOOK] signatureValid=${isValid}`);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid cryptographic signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    console.log(`[FACEBOOK][WEBHOOK] object=${payload.object} entryCount=${payload.entry?.length || 0}`);

    let events: import("@/lib/connectors/types").NormalizedMessageEvent[] = [];
    if (payload.object === "page") {
      events = FacebookMessengerConnector.parseWebhookPayload(payload);
    } else if (payload.object === "instagram") {
      events = InstagramConnector.parseWebhookPayload(payload);
    }

    console.log(`[FACEBOOK][WEBHOOK] eventsParsed=${events.length}`);

    const ingestionResults = [];
    for (const ev of events) {
      const redactedPsid = ev.senderExternalId && ev.senderExternalId.length > 6 
        ? `${ev.senderExternalId.substring(0, 3)}...${ev.senderExternalId.substring(ev.senderExternalId.length - 3)}`
        : "***";

      console.log(`[FACEBOOK][WEBHOOK] pageId=${ev.externalAccountId} senderPsid=${redactedPsid} recipientPageId=${ev.externalAccountId} eventType=message`);

      ev.environment = "LIVE";
      ev.sourceType = ev.platform;
      const res = await MessageHub.ingestMessage(ev);
      console.log(`[FACEBOOK][WEBHOOK] ingestResult isDuplicate=${res.isDuplicate} conversationId=${res.conversationId} messageId=${res.messageId}`);
      ingestionResults.push(res);
    }

    return NextResponse.json({
      status: "success",
      eventsProcessed: events.length,
      results: ingestionResults,
    });
  } catch (error: any) {
    console.error("[FACEBOOK][WEBHOOK] Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
