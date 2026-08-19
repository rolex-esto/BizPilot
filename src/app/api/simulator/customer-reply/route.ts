import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";
import { CustomerPersonaEngine, CustomerPersonaType } from "@/lib/simulator/customer-persona-engine";
import { DeveloperSimulator } from "@/lib/connectors/simulator";
import { MessageHub } from "@/lib/connectors/hub";

export const dynamic = "force-dynamic";

/**
 * POST /api/simulator/customer-reply
 * 
 * Generates and ingests the dynamic next-turn message from the simulated customer
 * based on conversation history, persona, and the owner's latest response.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse || !businessId) {
      return errorResponse || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { conversationId, persona, customText, simulatorAutoReply } = body;

    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    }

    // 1. Fetch Conversation & Messages
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        customer: true,
        messages: { orderBy: { sentAt: "asc" } },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (user?.role !== "ADMIN" && conversation.businessId !== businessId) {
      return NextResponse.json({ error: "Unauthorized access to conversation" }, { status: 403 });
    }

    if (conversation.environment === "LIVE") {
      return NextResponse.json(
        { error: "Cannot dispatch simulated reply to a live production conversation" },
        { status: 400 }
      );
    }

    // 2. Fetch Business Catalog & Settings for Grounding
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        settingsJson: true,
        products: {
          where: { isActive: true },
          select: { id: true, name: true, sku: true, price: true, stockQuantity: true, category: true },
        },
      },
    });

    const parsedSettings = business?.settingsJson ? JSON.parse(business.settingsJson) : {};
    const effectivePersona = (persona as CustomerPersonaType) || "CURIOUS_CUSTOMER";

    // 3. Generate Next Turn or use customText
    let messageText = customText?.trim();
    let inferredTopic = "CUSTOM";

    if (!messageText) {
      const historyTurns = conversation.messages.map((m) => ({
        direction: m.direction as "INBOUND" | "OUTBOUND",
        textContent: m.textContent,
        sentAt: m.sentAt,
      }));

      const generated = CustomerPersonaEngine.generateNextCustomerTurn(
        historyTurns,
        effectivePersona,
        business?.products || [],
        parsedSettings
      );
      messageText = generated.text;
      inferredTopic = generated.inferredTopic;
    }

    // 4. Ingest Simulated Inbound Event via MessageHub
    const simEvent = DeveloperSimulator.createSimulatedEvent(
      conversation.platform as any,
      conversation.customer.name,
      messageText,
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

    // 5. Simulator Auto-Reply Handling (Isolated to Practice Mode)
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
            isAiAutoReply: true,
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
      messageText,
      inferredTopic,
      ingestionResult,
      autoReplied,
      autoReplyMessage,
    });
  } catch (error: any) {
    console.error("Error generating simulated customer reply:", error);
    return NextResponse.json({ error: error.message || "Failed to generate customer reply" }, { status: 500 });
  }
}
