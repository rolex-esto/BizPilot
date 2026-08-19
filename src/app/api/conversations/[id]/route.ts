import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const conversationId = params.id;

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
