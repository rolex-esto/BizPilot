import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/api-guard";
import { RealtimeBroadcaster, RealtimeMessageEvent } from "@/lib/realtime/broadcaster";

export const dynamic = "force-dynamic";

/**
 * GET /api/realtime
 * 
 * Server-Sent Events (SSE) stream for authenticated store owners.
 * Pushes instant message and conversation updates without client-side polling delays.
 */
export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse || !user?.businessId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const businessId = user.businessId;
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connection confirmation
      const initPayload = JSON.stringify({
        type: "connected",
        businessId,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`data: ${initPayload}\n\n`));

      // 2. Subscribe to realtime broadcaster
      unsubscribe = RealtimeBroadcaster.subscribe(businessId, (event: RealtimeMessageEvent) => {
        try {
          const messageData = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${messageData}\n\n`));
        } catch {
          // Stream closed by client
        }
      });

      // 3. Keep-alive heartbeat every 15 seconds
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
        }
      }, 15000);
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
