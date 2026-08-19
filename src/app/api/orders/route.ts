import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders
 * Returns all orders strictly belonging to the authenticated user's business.
 */
export async function GET(req: NextRequest) {
  try {
    const { businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    if (!businessId) {
      return NextResponse.json({ status: "success", orders: [] });
    }

    const envParam = req.nextUrl.searchParams.get("environment") || req.nextUrl.searchParams.get("mode");
    const environment = envParam?.toUpperCase() === "PRACTICE" ? "PRACTICE" : "LIVE";

    const orders = await prisma.order.findMany({
      where: { businessId, environment },
      include: {
        customer: true,
        items: true,
        payments: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ status: "success", orders });
  } catch (error: any) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
