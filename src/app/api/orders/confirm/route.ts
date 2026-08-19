import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, customer: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (user?.role !== "ADMIN" && order.businessId !== businessId) {
      return NextResponse.json({ error: "Unauthorized access to order." }, { status: 403 });
    }

    if (order.status === "CONFIRMED" || order.status === "DELIVERED") {
      return NextResponse.json({ error: `Order is already ${order.status}` }, { status: 400 });
    }

    // Execute atomic transaction to confirm order and decrement inventory
    const result = await prisma.$transaction(async (tx) => {
      // 1. Decrement stock for each item
      for (const item of order.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product ${item.productName} not found.`);
        }

        if (product.stockQuantity < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stockQuantity}, Required: ${item.quantity}`);
        }

        await tx.product.update({
          where: { id: product.id },
          data: {
            stockQuantity: product.stockQuantity - item.quantity,
          },
        });
      }

      // 2. Update Order status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CONFIRMED",
        },
        include: { items: true, payments: true, customer: true },
      });

      // 3. Log Audit
      await tx.auditLog.create({
        data: {
          businessId: order.businessId,
          action: "ORDER_CONFIRMED",
          entityType: "Order",
          entityId: order.id,
          details: `Confirmed order ${order.orderNumber} and decremented inventory for ${order.items.length} product(s).`,
          performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
        },
      });

      return updatedOrder;
    });

    return NextResponse.json({
      status: "success",
      order: result,
    });
  } catch (error: any) {
    console.error("Order confirmation error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
