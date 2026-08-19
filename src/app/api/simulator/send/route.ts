import { NextRequest, NextResponse } from "next/server";
import { DeveloperSimulator } from "@/lib/connectors/simulator";
import { MessageHub } from "@/lib/connectors/hub";
import { requireBusinessAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { businessId: authBizId } = await requireBusinessAuth(req);

    const body = await req.json();
    const {
      platform,
      senderName,
      senderHandle,
      senderPhone,
      senderExternalId,
      textContent,
      businessId: reqBizId,
      simulatorAutoReply,
    } = body;

    if (!platform || !senderName || !textContent) {
      return NextResponse.json({ error: "Missing required simulation fields" }, { status: 400 });
    }

    const businessId = authBizId || reqBizId;

    const event = DeveloperSimulator.createSimulatedEvent(platform, senderName, textContent, {
      senderExternalId,
      senderHandle,
      senderPhone,
      businessId,
    });
    event.environment = "PRACTICE";
    event.sourceType = "SIMULATOR";

    const result = await MessageHub.ingestMessage(event);

    let autoReplied = false;
    let autoReplyMessage = null;

    // If Simulator Auto-Reply is enabled and conversation is not in OWNER_HANDLING mode
    if (simulatorAutoReply === true && result.conversationId && result.aiSuggestedReply) {
      const conv = await prisma.conversation.findUnique({
        where: { id: result.conversationId },
      });

      if (conv && conv.status !== "OWNER_HANDLING") {
        autoReplyMessage = await prisma.message.create({
          data: {
            conversationId: conv.id,
            customerId: conv.customerId,
            environment: "PRACTICE",
            sourceType: "SIMULATOR",
            platform: conv.platform,
            direction: "OUTBOUND",
            textContent: result.aiSuggestedReply,
            isRead: true,
            sentAt: new Date(),
            rawPayload: JSON.stringify({
              actorType: "AI",
              senderRole: "AI",
              isAiAutoReply: true,
              dispatchStatus: "SIMULATED_SENT",
              isPractice: true,
              environment: "PRACTICE",
              sourceType: "SIMULATOR",
            }),
          },
        });

        await prisma.conversation.update({
          where: { id: conv.id },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: result.aiSuggestedReply.substring(0, 120),
            unreadCount: 0,
          },
        });

        autoReplied = true;
      }
    }

    return NextResponse.json({
      status: "success",
      simulatedEvent: event,
      result,
      autoReplied,
      autoReplyMessage,
    });
  } catch (error: any) {
    console.error("Simulation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

