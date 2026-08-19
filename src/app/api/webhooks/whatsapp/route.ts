import { NextRequest, NextResponse } from "next/server";
import { verifyMetaWebhookHandshake } from "@/lib/connectors/security";
import { WhatsAppConnector } from "@/lib/connectors/whatsapp";
import { MessageHub } from "@/lib/connectors/hub";

const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || "mtb_wa_verify_token_2026";

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
  try {
    const payload = await req.json();
    const events = WhatsAppConnector.parseWebhookPayload(payload);

    const results = [];
    for (const ev of events) {
      ev.environment = "LIVE";
      ev.sourceType = "WHATSAPP";
      const res = await MessageHub.ingestMessage(ev);
      results.push(res);
    }

    return NextResponse.json({ status: "success", count: events.length, results });
  } catch (error: any) {
    console.error("WhatsApp Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
