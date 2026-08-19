import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";
import { DeveloperSimulator } from "@/lib/connectors/simulator";
import { MessageHub } from "@/lib/connectors/hub";

export const dynamic = "force-dynamic";

/**
 * POST /api/simulator/customer-message
 * 
 * Dedicated Simulator Customer Inbound Dispatcher:
 * 1. Authenticated owner owns the business.
 * 2. The conversation belongs to that business.
 * 3. The customer belongs to that conversation/business.
 * 4. The conversation is a PRACTICE/SIMULATOR conversation.
 * 5. The message is created strictly as CUSTOMER/INBOUND.
 * 6. No live social-media API is called.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse || !businessId) {
      return errorResponse || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { conversationId, simulatedCustomerId, messageContent, simulatorAutoReply } = body;

    if (!conversationId || !messageContent?.trim()) {
      return NextResponse.json({ error: "Missing conversationId or messageContent" }, { status: 400 });
    }

    // 1. Resolve Conversation & Customer
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { customer: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // 2. Strict Tenant Authorization
    if (user?.role !== "ADMIN" && conversation.businessId !== businessId) {
      return NextResponse.json({ error: "Unauthorized access to conversation" }, { status: 403 });
    }

    // 3. Customer belongs to conversation
    if (simulatedCustomerId && conversation.customerId !== simulatedCustomerId) {
      return NextResponse.json({ error: "Customer ID does not match conversation" }, { status: 400 });
    }

    // 4. Practice / Simulator Isolation Verification
    const isPractice =
      conversation.environment === "PRACTICE" ||
      conversation.customer.externalId?.startsWith("sim_") ||
      conversation.platform === "MANUAL" ||
      conversation.platform === "SIMULATOR";

    if (!isPractice || conversation.environment === "LIVE") {
      return NextResponse.json(
        { error: "Cannot dispatch simulated customer message to a live production channel" },
        { status: 400 }
      );
    }

    // 5. Create Simulated Inbound Customer Event (Zero Live API Calls)
    const simEvent = DeveloperSimulator.createSimulatedEvent(
      conversation.platform as any,
      conversation.customer.name,
      messageContent.trim(),
      {
        senderExternalId: conversation.customer.externalId || undefined,
        senderHandle: conversation.customer.handle || undefined,
        senderPhone: conversation.customer.phone || undefined,
        businessId,
      }
    );
    simEvent.environment = "PRACTICE";
    simEvent.sourceType = "SIMULATOR";

    const ingestionResult = await MessageHub.ingestMessage(simEvent);

    let autoReplied = false;
    let autoReplyMessage = null;

    // 6. Optional AI Auto-Reply Mode (Simulator-Isolated)
    if (
      simulatorAutoReply === true &&
      conversation.status !== "OWNER_HANDLING" &&
      ingestionResult.aiSuggestedReply
    ) {
      autoReplyMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          customerId: conversation.customerId,
          environment: "PRACTICE",
          sourceType: "SIMULATOR",
          platform: conversation.platform,
          direction: "OUTBOUND",
          textContent: ingestionResult.aiSuggestedReply,
          isRead: true,
          sentAt: new Date(),
          rawPayload: JSON.stringify({
            actorType: "AI",
            senderRole: "AI",
            dispatchStatus: "SIMULATED_SENT",
            isPractice: true,
            environment: "PRACTICE",
            sourceType: "SIMULATOR",
          }),
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: ingestionResult.aiSuggestedReply.substring(0, 120),
          unreadCount: 0,
        },
      });

      autoReplied = true;
    }

    return NextResponse.json({
      status: "success",
      messageContent: messageContent.trim(),
      ingestionResult,
      autoReplied,
      autoReplyMessage,
    });
  } catch (error: any) {
    console.error("Error creating simulator customer message:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create customer message" },
      { status: 500 }
    );
  }
}
