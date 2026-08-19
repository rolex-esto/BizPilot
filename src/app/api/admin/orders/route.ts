import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/api-guard";
import { getActiveSupportSession, maskName, maskPhone, maskAddress } from "@/lib/auth/support-session";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orders
 * Returns customer orders across businesses with privacy-first masking.
 * Private details (customer name, phone, address, notes) are masked unless an active Support Session is open.
 */
export async function GET(req: NextRequest) {
  try {
    const { user: currentAdmin, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.toLowerCase().trim() || "";
    const statusFilter = url.searchParams.get("status") || "";
    const businessId = url.searchParams.get("businessId") || "";

    const where: any = {};
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { business: { name: { contains: search } } },
      ];
    }
    if (statusFilter) {
      where.status = statusFilter;
    }
    if (businessId) {
      where.businessId = businessId;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        business: {
          select: { id: true, name: true, ownerName: true },
        },
        payments: {
          select: { id: true, paymentMethod: true, status: true, amount: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Check active support sessions for businesses in the results
    const businessIds = Array.from(new Set(orders.map((o) => o.businessId)));
    const activeSessions = await Promise.all(
      businessIds.map((bId) => getActiveSupportSession(currentAdmin!.id, bId))
    );
    const authorizedBusinessIds = new Set(
      activeSessions.filter(Boolean).map((s) => s!.businessId)
    );

    // Apply Privacy Masking
    const privacySafeOrders = orders.map((o) => {
      const isAuthorized = authorizedBusinessIds.has(o.businessId);

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        businessId: o.businessId,
        business: o.business,
        totalAmount: o.totalAmount,
        discountAmount: o.discountAmount,
        fulfillmentMethod: o.fulfillmentMethod,
        status: o.status,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        items: o.items,
        payments: o.payments,
        hasSupportAccess: isAuthorized,
        // Privacy Protected Fields:
        customer: {
          id: o.customer.id,
          name: isAuthorized ? o.customer.name : maskName(o.customer.name),
          phone: isAuthorized ? o.customer.phone : maskPhone(o.customer.phone),
          email: isAuthorized ? o.customer.email : "[Hidden — Owner Privacy Protected]",
        },
        deliveryAddress: isAuthorized ? o.deliveryAddress : maskAddress(o.deliveryAddress),
        courier: o.courier,
        trackingNumber: o.trackingNumber,
        notes: isAuthorized ? o.notes : null, // Private owner notes hidden by default
      };
    });

    return NextResponse.json({
      status: "success",
      orders: privacySafeOrders,
    });
  } catch (error: any) {
    console.error("Admin list orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/orders
 * Administrative order correction with audit log.
 */
export async function PUT(req: NextRequest) {
  try {
    const { user: currentAdmin, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { orderId, status, notes } = body;

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const targetOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { business: true },
    });

    if (!targetOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id: orderId },
        data: {
          ...(status ? { status } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
      });

      // Record audit log
      await tx.auditLog.create({
        data: {
          businessId: targetOrder.businessId,
          action: "ORDER_UPDATED",
          entityType: "Order",
          entityId: targetOrder.id,
          details: `Admin ${currentAdmin?.email} updated order ${targetOrder.orderNumber} (Status: ${status || targetOrder.status})`,
          performedBy: "ADMIN",
        },
      });

      return o;
    });

    return NextResponse.json({
      status: "success",
      message: `Order "${updated.orderNumber}" updated successfully`,
      order: updated,
    });
  } catch (error: any) {
    console.error("Admin update order error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
