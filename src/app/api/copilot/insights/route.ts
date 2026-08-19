import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    if (!businessId) {
      return NextResponse.json({
        status: "success",
        insights: [],
        radar: {
          hotLeadsCount: 0,
          lowStockCount: 0,
          unpaidOrdersCount: 0,
          activeConversationsCount: 0,
        },
      });
    }

    // Fetch active insights
    const insights = await prisma.aiInsight.findMany({
      where: { businessId, isResolved: false },
      orderBy: { createdAt: "desc" },
    });

    // Compute live radar metrics directly from database
    const [hotLeadsCount, lowStockCount, unpaidOrdersCount, activeConversationsCount] = await Promise.all([
      prisma.customer.count({ where: { businessId, leadStatus: "HOT" } }),
      prisma.product.count({
        where: {
          businessId,
          isActive: true,
          stockQuantity: { lte: 5 },
        },
      }),
      prisma.payment.count({
        where: {
          businessId,
          status: { in: ["UNPAID", "PENDING_VERIFICATION"] },
        },
      }),
      prisma.conversation.count({ where: { businessId, unreadCount: { gt: 0 } } }),
    ]);

    return NextResponse.json({
      status: "success",
      insights,
      radar: {
        hotLeadsCount,
        lowStockCount,
        unpaidOrdersCount,
        activeConversationsCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
