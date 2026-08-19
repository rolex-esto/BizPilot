import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        items: { include: { product: true } },
        payments: true,
        customer: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Strict Multi-tenant isolation: Owner can only view their own store's order
    if (user?.role !== "ADMIN" && order.businessId !== businessId) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ status: "success", order });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const {
      status, // PENDING, CONFIRMED, PACKED, SHIPPED, DELIVERED, CANCELLED
      courierTracking,
      meetupSchedule,
      meetupLocation,
      meetupStatus, // SCHEDULED, COMPLETED, CANCELLED
      pickupSchedule,
      pickupLocation,
      pickupStatus, // READY_FOR_PICKUP, PICKED_UP
      notes,
    } = body;

    const existingOrder = await prisma.order.findUnique({
      where: { id: params.id },
      include: { customer: true, payments: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Strict Multi-tenant isolation: Owner can only modify their own store's order
    if (user?.role !== "ADMIN" && existingOrder.businessId !== businessId) {
      return NextResponse.json({ error: "Unauthorized access to order." }, { status: 403 });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: params.id },
      data: {
        ...(status ? { status } : {}),
        ...(courierTracking !== undefined ? { courierTracking, trackingNumber: courierTracking } : {}),
        ...(meetupSchedule ? { meetupSchedule: new Date(meetupSchedule) } : {}),
        ...(meetupLocation !== undefined ? { meetupLocation } : {}),
        ...(meetupStatus ? { meetupStatus } : {}),
        ...(pickupSchedule ? { pickupSchedule: new Date(pickupSchedule) } : {}),
        ...(pickupLocation !== undefined ? { pickupLocation } : {}),
        ...(pickupStatus ? { pickupStatus } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      include: {
        items: true,
        payments: true,
        customer: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId: existingOrder.businessId,
        action: "ORDER_UPDATED",
        entityType: "Order",
        entityId: updatedOrder.id,
        details: `Updated order ${updatedOrder.orderNumber}: Status=${updatedOrder.status}, Meetup=${updatedOrder.meetupStatus || "N/A"}, Tracking=${updatedOrder.courierTracking || "N/A"}`,
        performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
      },
    });

    return NextResponse.json({ status: "success", order: updatedOrder });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
