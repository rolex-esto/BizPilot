import { NextRequest, NextResponse } from "next/server";
import { verifyMetaWebhookHandshake } from "@/lib/connectors/security";
import { WhatsAppConnector } from "@/lib/connectors/whatsapp";
import { MessageHub } from "@/lib/connectors/hub";

const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || "mtb_wa_verify_token_2026";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const result = verifyMetaWebhookHandshake(mode, token, challenge, WA_VERIFY_TOKEN);

  if (result.isValid && result.challenge) {
    return new NextResponse(result.challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const correlationId = `wa_wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startTime = Date.now();

  try {
    const payload = await req.json();
    const events = WhatsAppConnector.parseWebhookPayload(payload);

    console.log(`[WHATSAPP][WEBHOOK][${correlationId}] eventsParsed=${events.length}`);

    const results = [];
    for (const ev of events) {
      ev.environment = "LIVE";
      ev.sourceType = "WHATSAPP";
      const res = await MessageHub.ingestMessage(ev);
      results.push(res);
    }

    const durationMs = Date.now() - startTime;
    console.log(`[WHATSAPP][WEBHOOK][${correlationId}] completed=true durationMs=${durationMs} eventsProcessed=${events.length}`);

    return NextResponse.json({ status: "success", correlationId, count: events.length, results });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error(`[WHATSAPP][WEBHOOK][${correlationId}] Error after ${durationMs}ms:`, error);
    return NextResponse.json({ error: error.message, correlationId }, { status: 500 });
  }
}
