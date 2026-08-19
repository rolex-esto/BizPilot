import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/products
 * Returns view-only product catalog health across businesses.
 * Product and inventory control belongs exclusively to the store owner.
 */
export async function GET(req: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.toLowerCase().trim() || "";
    const businessId = url.searchParams.get("businessId") || "";

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { category: { contains: search } },
      ];
    }
    if (businessId) {
      where.businessId = businessId;
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        business: {
          select: { id: true, name: true, ownerName: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      status: "success",
      products,
    });
  } catch (error: any) {
    console.error("Admin list products error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/products
 * Restricted: Product and stock control is exclusively managed by store owners.
 */
export async function PUT() {
  return NextResponse.json(
    {
      error: "Product and stock control is exclusively managed by store owners. Administrators have view-only access to catalog health.",
    },
    { status: 403 }
  );
}
