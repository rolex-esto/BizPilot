import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

/**
 * POST /api/simulator/reset
 * 
 * Resets or clears practice / simulated conversations for the business
 * without affecting any live production channels or real customers.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse || !businessId) {
      return errorResponse || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { conversationId, resetAll } = body;

    if (conversationId) {
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { customer: true },
      });

      if (!conv) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }

      if (user?.role !== "ADMIN" && conv.businessId !== businessId) {
        return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
      }

      // Safety Guard: Only permit reset if environment is PRACTICE
      if (conv.environment === "LIVE") {
        return NextResponse.json({ error: "Cannot reset live production customer conversation" }, { status: 400 });
      }

      await prisma.message.deleteMany({ where: { conversationId: conv.id, environment: "PRACTICE" } });
      await prisma.lead.deleteMany({ where: { customerId: conv.customerId, environment: "PRACTICE" } });
      await prisma.order.deleteMany({ where: { customerId: conv.customerId, environment: "PRACTICE" } });
      await prisma.payment.deleteMany({ where: { customerId: conv.customerId, environment: "PRACTICE" } });
      await prisma.conversation.delete({ where: { id: conv.id } });
      await prisma.customer.deleteMany({ where: { id: conv.customerId, environment: "PRACTICE" } }).catch(() => {});

      return NextResponse.json({
        status: "success",
        message: "Simulated conversation reset successfully",
      });
    }

    if (resetAll) {
      // Find all simulated practice customers and conversations for current business
      const simCustomers = await prisma.customer.findMany({
        where: {
          businessId,
          environment: "PRACTICE",
        },
        select: { id: true },
      });

      const customerIds = simCustomers.map((c) => c.id);

      await prisma.message.deleteMany({
        where: { environment: "PRACTICE", conversation: { businessId } },
      });
      await prisma.lead.deleteMany({
        where: { businessId, environment: "PRACTICE" },
      });
      await prisma.order.deleteMany({
        where: { businessId, environment: "PRACTICE" },
      });
      await prisma.payment.deleteMany({
        where: { businessId, environment: "PRACTICE" },
      });
      await prisma.conversation.deleteMany({
        where: { businessId, environment: "PRACTICE" },
      });
      await prisma.customer.deleteMany({
        where: { businessId, environment: "PRACTICE" },
      });

      return NextResponse.json({
        status: "success",
        clearedCount: customerIds.length,
        message: `Cleared all practice simulator conversations and data for your store.`,
      });
    }

    return NextResponse.json({ error: "Specify conversationId or resetAll: true" }, { status: 400 });
  } catch (error: any) {
    console.error("Error resetting simulator data:", error);
    return NextResponse.json({ error: error.message || "Failed to reset simulator" }, { status: 500 });
  }
}
