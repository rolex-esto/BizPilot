import { NextRequest, NextResponse } from "next/server";
import { TikTokConnector } from "@/lib/connectors/tiktok";
import { MessageHub } from "@/lib/connectors/hub";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const events = TikTokConnector.parseWebhookPayload(payload);

    const results = [];
    for (const ev of events) {
      ev.environment = "LIVE";
      ev.sourceType = "TIKTOK";
      const res = await MessageHub.ingestMessage(ev);
      results.push(res);
    }

    return NextResponse.json({
      status: "success",
      eventsProcessed: events.length,
      platformStatus: TikTokConnector.capabilities.statusNotes,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
