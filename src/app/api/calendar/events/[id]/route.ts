import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const event = await prisma.calendarEvent.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        order: { include: { items: true, payments: true } },
        lead: { include: { interestedProduct: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (user?.role !== "ADMIN" && event.businessId !== businessId) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ status: "success", event });
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
      status, // SCHEDULED, COMPLETED, CANCELLED
      title,
      description,
      startAt,
      endAt,
      location,
      reminderMinutes,
    } = body;

    const existingEvent = await prisma.calendarEvent.findUnique({
      where: { id: params.id },
      include: { order: true, lead: true },
    });

    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (user?.role !== "ADMIN" && existingEvent.businessId !== businessId) {
      return NextResponse.json({ error: "Unauthorized access to calendar event." }, { status: 403 });
    }

    const updatedEvent = await prisma.calendarEvent.update({
      where: { id: params.id },
      data: {
        ...(status ? { status } : {}),
        ...(title ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(startAt ? { startAt: new Date(startAt) } : {}),
        ...(endAt ? { endAt: new Date(endAt) } : {}),
        ...(location !== undefined ? { location: location?.trim() || null } : {}),
        ...(reminderMinutes !== undefined ? { reminderMinutes: Number(reminderMinutes) } : {}),
      },
      include: {
        customer: true,
        order: true,
        lead: true,
      },
    });

    // If linked to an order and marked COMPLETED, update the order's meetup/pickup status
    if (status === "COMPLETED" && existingEvent.orderId) {
      if (existingEvent.eventType === "CUSTOMER_MEETUP") {
        await prisma.order.update({
          where: { id: existingEvent.orderId },
          data: { meetupStatus: "COMPLETED", status: "DELIVERED" },
        });
      } else if (existingEvent.eventType === "STORE_PICKUP") {
        await prisma.order.update({
          where: { id: existingEvent.orderId },
          data: { pickupStatus: "PICKED_UP", status: "DELIVERED" },
        });
      }
    }

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        businessId: existingEvent.businessId,
        action: "CALENDAR_EVENT_UPDATED",
        entityType: "CalendarEvent",
        entityId: updatedEvent.id,
        details: `Updated calendar event: ${updatedEvent.title} (Status: ${updatedEvent.status})`,
        performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
      },
    });

    return NextResponse.json({ status: "success", event: updatedEvent });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const existingEvent = await prisma.calendarEvent.findUnique({
      where: { id: params.id },
    });

    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (user?.role !== "ADMIN" && existingEvent.businessId !== businessId) {
      return NextResponse.json({ error: "Unauthorized access to calendar event." }, { status: 403 });
    }

    await prisma.calendarEvent.delete({
      where: { id: params.id },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        businessId: existingEvent.businessId,
        action: "CALENDAR_EVENT_DELETED",
        entityType: "CalendarEvent",
        entityId: params.id,
        details: `Deleted calendar event: ${existingEvent.title}`,
        performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
      },
    });

    return NextResponse.json({ status: "success", message: "Event removed from calendar" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
