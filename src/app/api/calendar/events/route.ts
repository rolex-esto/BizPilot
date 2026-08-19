import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    if (!businessId) {
      return NextResponse.json({ status: "success", events: [], summary: { todayCount: 0, upcomingCount: 0, overdueCount: 0 } });
    }

    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get("type"); // ALL, MEETUP, PICKUP, LBC, FOLLOWUP, PAYMENT
    const view = searchParams.get("view") || "month";

    // 1. Fetch persisted CalendarEvent records
    const storedEvents = await prisma.calendarEvent.findMany({
      where: {
        businessId,
        ...(typeFilter && typeFilter !== "ALL"
          ? {
              eventType: {
                in:
                  typeFilter === "MEETUP"
                    ? ["CUSTOMER_MEETUP"]
                    : typeFilter === "PICKUP"
                    ? ["STORE_PICKUP"]
                    : typeFilter === "LBC"
                    ? ["LBC_SHIPMENT"]
                    : typeFilter === "FOLLOWUP"
                    ? ["FOLLOW_UP", "NEGOTIATION_FOLLOW_UP"]
                    : typeFilter === "PAYMENT"
                    ? ["PAYMENT_COLLECTION"]
                    : [typeFilter],
              },
            }
          : {}),
      },
      include: {
        customer: true,
        order: { include: { items: true, payments: true } },
        lead: { include: { interestedProduct: true } },
      },
      orderBy: { startAt: "asc" },
    });

    // 2. Derive calendar events from active orders if not already in storedEvents
    const ordersWithSchedule = await prisma.order.findMany({
      where: {
        businessId,
        status: { not: "CANCELLED" },
        OR: [
          { meetupSchedule: { not: null } },
          { pickupSchedule: { not: null } },
          { courier: { not: null } },
        ],
      },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: true,
      },
    });

    const derivedEvents: any[] = [];
    const storedOrderEventIds = new Set(
      storedEvents.filter((e) => e.orderId).map((e) => `${e.orderId}_${e.eventType}`)
    );

    for (const order of ordersWithSchedule) {
      // Meetup event
      if (order.meetupSchedule && !storedOrderEventIds.has(`${order.id}_CUSTOMER_MEETUP`)) {
        derivedEvents.push({
          id: `derived_meetup_${order.id}`,
          businessId: order.businessId,
          orderId: order.id,
          customerId: order.customerId,
          title: `🤝 Meetup with ${order.customer.name}`,
          description: `Customer Meetup at ${order.meetupLocation || "Agreed Meeting Spot"} for Order ${order.orderNumber} (Total: ₱${order.totalAmount.toLocaleString()})`,
          eventType: "CUSTOMER_MEETUP",
          location: order.meetupLocation || "Agreed Meeting Spot",
          startAt: order.meetupSchedule,
          endAt: new Date(new Date(order.meetupSchedule).getTime() + 60 * 60 * 1000), // 1 hr duration
          status: order.meetupStatus === "COMPLETED" ? "COMPLETED" : "SCHEDULED",
          customer: order.customer,
          order: order,
          isDerived: true,
        });
      }

      // Pickup event
      if (order.pickupSchedule && !storedOrderEventIds.has(`${order.id}_STORE_PICKUP`)) {
        derivedEvents.push({
          id: `derived_pickup_${order.id}`,
          businessId: order.businessId,
          orderId: order.id,
          customerId: order.customerId,
          title: `📍 Store Pickup — ${order.customer.name}`,
          description: `Store pickup for Order ${order.orderNumber} at ${order.pickupLocation || "Store Counter"}`,
          eventType: "STORE_PICKUP",
          location: order.pickupLocation || "Store Counter",
          startAt: order.pickupSchedule,
          endAt: new Date(new Date(order.pickupSchedule).getTime() + 30 * 60 * 1000),
          status: order.pickupStatus === "PICKED_UP" ? "COMPLETED" : "SCHEDULED",
          customer: order.customer,
          order: order,
          isDerived: true,
        });
      }

      // LBC / Courier shipment event
      if (order.courier === "LBC" && !storedOrderEventIds.has(`${order.id}_LBC_SHIPMENT`)) {
        const dropoffDate = order.createdAt;
        derivedEvents.push({
          id: `derived_lbc_${order.id}`,
          businessId: order.businessId,
          orderId: order.id,
          customerId: order.customerId,
          title: `📦 LBC Drop-Off: ${order.customer.name}`,
          description: `Drop off parcel at LBC branch for ${order.customer.name} (Tracking: ${order.courierTracking || order.trackingNumber || "Pending"})`,
          eventType: "LBC_SHIPMENT",
          location: "LBC Express Branch",
          startAt: dropoffDate,
          endAt: new Date(new Date(dropoffDate).getTime() + 60 * 60 * 1000),
          status: order.status === "DELIVERED" ? "COMPLETED" : "SCHEDULED",
          customer: order.customer,
          order: order,
          isDerived: true,
        });
      }
    }

    // 3. Derive Follow-Up events from negotiating leads
    const negotiatingLeads = await prisma.lead.findMany({
      where: {
        businessId,
        status: "NEGOTIATING",
      },
      include: {
        customer: true,
        interestedProduct: true,
      },
    });

    const storedLeadEventIds = new Set(
      storedEvents.filter((e) => e.leadId).map((e) => e.leadId)
    );

    for (const lead of negotiatingLeads) {
      if (!storedLeadEventIds.has(lead.id)) {
        // Schedule follow-up 24 hours after lead creation
        const followUpTime = new Date(new Date(lead.updatedAt).getTime() + 24 * 60 * 60 * 1000);
        derivedEvents.push({
          id: `derived_lead_${lead.id}`,
          businessId: lead.businessId,
          leadId: lead.id,
          customerId: lead.customerId,
          title: `💬 Follow up with ${lead.customer.name} — ${lead.interestedProduct?.name || "deal"} negotiation`,
          description: `Customer negotiated offer of ₱${lead.offeredPrice || lead.estimatedValue}. Follow up to close sale.`,
          eventType: "NEGOTIATION_FOLLOW_UP",
          location: lead.customer.primaryPlatform || "Chat",
          startAt: followUpTime,
          endAt: new Date(followUpTime.getTime() + 30 * 60 * 1000),
          status: "SCHEDULED",
          customer: lead.customer,
          lead: lead,
          isDerived: true,
        });
      }
    }

    // Combine and apply filter
    let allEvents = [...storedEvents, ...derivedEvents];

    if (typeFilter && typeFilter !== "ALL") {
      allEvents = allEvents.filter((e) => {
        if (typeFilter === "MEETUP") return e.eventType === "CUSTOMER_MEETUP";
        if (typeFilter === "PICKUP") return e.eventType === "STORE_PICKUP";
        if (typeFilter === "LBC") return e.eventType === "LBC_SHIPMENT";
        if (typeFilter === "FOLLOWUP") return e.eventType === "FOLLOW_UP" || e.eventType === "NEGOTIATION_FOLLOW_UP";
        if (typeFilter === "PAYMENT") return e.eventType === "PAYMENT_COLLECTION";
        return e.eventType === typeFilter;
      });
    }

    // Sort chronologically
    allEvents.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    // Calculate dynamic summary stats
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayCount = allEvents.filter((e) => {
      const d = new Date(e.startAt);
      return d >= startOfToday && d <= endOfToday && e.status === "SCHEDULED";
    }).length;

    const upcomingCount = allEvents.filter((e) => {
      const d = new Date(e.startAt);
      return d > endOfToday && e.status === "SCHEDULED";
    }).length;

    const overdueCount = allEvents.filter((e) => {
      const d = new Date(e.startAt);
      return d < startOfToday && e.status === "SCHEDULED";
    }).length;

    return NextResponse.json({
      status: "success",
      events: allEvents,
      summary: {
        todayCount,
        upcomingCount,
        overdueCount,
        totalScheduled: todayCount + upcomingCount,
      },
    });
  } catch (error: any) {
    console.error("Calendar GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, businessId: authBizId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const businessId = authBizId || body.businessId;

    if (!businessId) {
      return NextResponse.json({ error: "Business ID is required." }, { status: 400 });
    }

    const {
      title,
      description,
      eventType, // CUSTOMER_MEETUP, STORE_PICKUP, LBC_SHIPMENT, FOLLOW_UP, PAYMENT_COLLECTION, GENERAL
      location,
      startAt,
      endAt,
      customerId,
      orderId,
      leadId,
      reminderMinutes,
    } = body;

    if (!title || !startAt) {
      return NextResponse.json({ error: "Title and start date/time are required." }, { status: 400 });
    }

    const startDate = new Date(startAt);
    const endDate = endAt ? new Date(endAt) : new Date(startDate.getTime() + 60 * 60 * 1000);

    const event = await prisma.calendarEvent.create({
      data: {
        businessId,
        title: title.trim(),
        description: description?.trim() || null,
        eventType: eventType || "GENERAL",
        location: location?.trim() || null,
        startAt: startDate,
        endAt: endDate,
        customerId: customerId || null,
        orderId: orderId || null,
        leadId: leadId || null,
        reminderMinutes: reminderMinutes ? Number(reminderMinutes) : 30,
        status: "SCHEDULED",
      },
      include: {
        customer: true,
        order: true,
        lead: true,
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        businessId,
        action: "CALENDAR_EVENT_CREATED",
        entityType: "CalendarEvent",
        entityId: event.id,
        details: `Created calendar event: ${event.title} (${event.eventType}) on ${startDate.toLocaleString()}`,
        performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
      },
    });

    return NextResponse.json({ status: "success", event }, { status: 201 });
  } catch (error: any) {
    console.error("Calendar POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
