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
  const startTime = Date.now();
  const correlationId = `meta_wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[META][WEBHOOK][${correlationId}] method=POST received=true timestamp=${new Date().toISOString()}`);

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");

    console.log(`[META][WEBHOOK][${correlationId}] signaturePresent=${Boolean(signature)} bodyLength=${rawBody.length}`);

    // Enforce HMAC signature verification strictly whenever signature header is provided,
    // or when running in production/staging environment.
    const isProductionOrStaging = process.env.NODE_ENV === "production" || process.env.APP_ENV === "staging";
    if (signature || isProductionOrStaging) {
      if (!signature) {
        console.warn(`[META][WEBHOOK][${correlationId}] signatureValid=false (Missing signature header in production)`);
        return NextResponse.json({ error: "Missing x-hub-signature-256 header" }, { status: 401 });
      }
      const isValid = verifyMetaSignature(rawBody, signature, META_APP_SECRET);
      console.log(`[META][WEBHOOK][${correlationId}] signatureValid=${isValid}`);
      if (!isValid) {
        console.warn(`[META][WEBHOOK][${correlationId}] signatureValid=false (Cryptographic mismatch)`);
        return NextResponse.json({ error: "Invalid cryptographic signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    console.log(`[META][WEBHOOK][${correlationId}] object=${payload.object} entryCount=${payload.entry?.length || 0}`);

    let events: import("@/lib/connectors/types").NormalizedMessageEvent[] = [];
    if (payload.object === "page") {
      events = FacebookMessengerConnector.parseWebhookPayload(payload);
    } else if (payload.object === "instagram") {
      events = InstagramConnector.parseWebhookPayload(payload);
    }

    console.log(`[META][WEBHOOK][${correlationId}] eventsParsed=${events.length}`);

    const ingestionResults = [];
    for (const ev of events) {
      const redactedPsid = ev.senderExternalId && ev.senderExternalId.length > 6 
        ? `${ev.senderExternalId.substring(0, 3)}...${ev.senderExternalId.substring(ev.senderExternalId.length - 3)}`
        : "***";

      console.log(`[META][WEBHOOK][${correlationId}] platform=${ev.platform} pageId=${ev.externalAccountId} sender=${redactedPsid} direction=${ev.direction}`);

      ev.environment = "LIVE";
      ev.sourceType = ev.platform;
      const res = await MessageHub.ingestMessage(ev);
      console.log(`[META][WEBHOOK][${correlationId}] ingestResult isDuplicate=${res.isDuplicate} conversationId=${res.conversationId} messageId=${res.messageId}`);
      ingestionResults.push(res);
    }

    const durationMs = Date.now() - startTime;
    console.log(`[META][WEBHOOK][${correlationId}] completed=true durationMs=${durationMs} eventsProcessed=${events.length}`);

    return NextResponse.json({
      status: "success",
      correlationId,
      eventsProcessed: events.length,
      durationMs,
      results: ingestionResults,
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error(`[META][WEBHOOK][${correlationId}] Error after ${durationMs}ms:`, error);
    return NextResponse.json({ error: error.message || "Internal server error", correlationId }, { status: 500 });
  }
}
