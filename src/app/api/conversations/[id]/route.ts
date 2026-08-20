import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const conversationId = params.id;
    const searchParams = req.nextUrl.searchParams;
    const sinceParam = searchParams.get("since");
    const deltaOnly = searchParams.get("deltaOnly") === "true";
    const serverTimestamp = new Date().toISOString();

    // 1. High-Performance Active Thread Delta Polling
    if (sinceParam && deltaOnly) {
      const sinceDate = new Date(isNaN(Number(sinceParam)) ? sinceParam : Number(sinceParam));
      if (!isNaN(sinceDate.getTime())) {
        const convSummary = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { id: true, businessId: true, unreadCount: true },
        });

        if (!convSummary || (user?.role !== "ADMIN" && convSummary.businessId !== businessId)) {
          return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }

        const newMessages = await prisma.message.findMany({
          where: {
            conversationId,
            sentAt: { gt: sinceDate },
          },
          orderBy: { sentAt: "asc" },
        });

        if (newMessages.length === 0) {
          return NextResponse.json({
            status: "success",
            hasUpdates: false,
            serverTimestamp,
            newMessages: [],
          });
        }

        if (convSummary.unreadCount > 0) {
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { unreadCount: 0 },
          });
          await prisma.message.updateMany({
            where: { conversationId, isRead: false },
            data: { isRead: true },
          });
        }

        return NextResponse.json({
          status: "success",
          hasUpdates: true,
          serverTimestamp,
          newMessages,
        });
      }
    }

    // 2. Full Conversation & Message Thread Query
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        customer: {
          include: {
            orders: {
              include: { items: true, payments: true },
              orderBy: { createdAt: "desc" },
            },
            leads: {
              include: { interestedProduct: true },
              orderBy: { createdAt: "desc" },
            },
            identityLinks: true,
          },
        },
        messages: {
          orderBy: { sentAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Strict multi-tenant isolation: Owner can only view their own store's conversation
    if (user?.role !== "ADMIN" && conversation.businessId !== businessId) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Mark unread messages as read
    if (conversation.unreadCount > 0) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { unreadCount: 0 },
      });
      await prisma.message.updateMany({
        where: { conversationId, isRead: false },
        data: { isRead: true },
      });
    }

    return NextResponse.json({
      status: "success",
      hasUpdates: true,
      serverTimestamp,
      conversation,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const conversationId = params.id;
    const body = await req.json();
    const { status } = body;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (user?.role !== "ADMIN" && conversation.businessId !== businessId) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        ...(status ? { status } : {}),
      },
    });

    return NextResponse.json({
      status: "success",
      conversation: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/conversations/[id]
 * 
 * Truthful Deletion Handler:
 * Deletes the conversation and its local message records from BizPilot.
 * Clearly informs the owner that local deletion does NOT delete messages from Meta / Instagram / WhatsApp.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const conversationId = params.id;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (user?.role !== "ADMIN" && conversation.businessId !== businessId) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Delete associated messages, then the conversation
    await prisma.$transaction([
      prisma.message.deleteMany({ where: { conversationId } }),
      prisma.conversation.delete({ where: { id: conversationId } }),
      prisma.auditLog.create({
        data: {
          businessId: conversation.businessId,
          action: "CONVERSATION_DELETED",
          entityType: "Conversation",
          entityId: conversationId,
          details: `Deleted conversation ${conversationId} (${conversation.environment}) locally from BizPilot. Platform deletion not performed.`,
          performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
        },
      }),
    ]);

    return NextResponse.json({
      status: "success",
      deletedId: conversationId,
      message: "Deleted from BizPilot only. The original messages remain on the connected social platform.",
      platformDeletionSynchronized: false,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

