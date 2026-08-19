import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CalendarProviderFactory } from "@/lib/calendar/provider";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const event = await prisma.calendarEvent.findUnique({
      where: { id: params.id },
      include: { customer: true, order: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Calendar event not found" }, { status: 404 });
    }

    if (user?.role !== "ADMIN" && event.businessId !== businessId) {
      return NextResponse.json({ error: "Unauthorized access to calendar event." }, { status: 403 });
    }

    // Check if event is already synced
    if (event.externalEventId) {
      return NextResponse.json({
        status: "success",
        isAlreadySynced: true,
        externalEventId: event.externalEventId,
        message: "This event is already connected to your calendar.",
      });
    }

    // Check connected calendar provider for this business
    const connection = await prisma.calendarConnection.findFirst({
      where: {
        businessId: event.businessId,
        status: "CONNECTED",
      },
    });

    if (!connection) {
      return NextResponse.json({
        status: "error",
        connected: false,
        message: "Your calendar isn't connected yet. Please connect Google Calendar in Settings.",
      }, { status: 400 });
    }

    const provider = CalendarProviderFactory.getProvider(connection.provider);
    const syncResult = await provider.createEvent(connection.accessTokenEncrypted, {
      title: event.title,
      description: event.description || `BizPilot Event: ${event.eventType}`,
      location: event.location || undefined,
      startAt: event.startAt,
      endAt: event.endAt || undefined,
    });

    if (!syncResult.success) {
      return NextResponse.json({
        status: "error",
        message: syncResult.error || "Failed to sync with external calendar.",
      }, { status: 400 });
    }

    // Update event with externalEventId
    const updatedEvent = await prisma.calendarEvent.update({
      where: { id: event.id },
      data: {
        calendarProvider: connection.provider,
        externalEventId: syncResult.externalEventId,
      },
    });

    return NextResponse.json({
      status: "success",
      message: `Added to ${connection.provider === "GOOGLE" ? "Google Calendar" : "Outlook"} successfully!`,
      event: updatedEvent,
      htmlLink: syncResult.htmlLink,
    });
  } catch (error: any) {
    console.error("Calendar sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
