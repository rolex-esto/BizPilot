import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { productId, newStockQuantity, adjustmentAmount, reason } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (user?.role !== "ADMIN" && product.businessId !== businessId) {
      return NextResponse.json({ error: "Unauthorized access to product." }, { status: 403 });
    }

    let finalStock = product.stockQuantity;
    if (typeof newStockQuantity === "number") {
      finalStock = Math.max(0, newStockQuantity);
    } else if (typeof adjustmentAmount === "number") {
      finalStock = Math.max(0, product.stockQuantity + adjustmentAmount);
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { stockQuantity: finalStock },
    });

    await prisma.auditLog.create({
      data: {
        businessId: product.businessId,
        action: "INVENTORY_ADJUSTED",
        entityType: "Product",
        entityId: product.id,
        details: `Adjusted stock for ${product.name} from ${product.stockQuantity} to ${finalStock}. Reason: ${reason || "Manual adjustment"}`,
        performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
      },
    });

    return NextResponse.json({ status: "success", product: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
