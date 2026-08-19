import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/api-guard";

/**
 * PUT /api/settings/notifications
 * 
 * Updates notification preferences in Business.settingsJson.
 * Mandatory operational and security alerts (trial reminders, billing, security) are preserved.
 */
export async function PUT(req: NextRequest) {
  try {
    const { user: authUser, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const user = await prisma.user.findUnique({
      where: { id: authUser!.id },
      select: { businessId: true },
    });

    if (!user || !user.businessId) {
      return NextResponse.json({ error: "Business profile not found." }, { status: 404 });
    }

    const body = await req.json();
    const { notifications } = body;

    if (!notifications || typeof notifications !== "object") {
      return NextResponse.json({ error: "Invalid notification preferences." }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { id: user.businessId },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const currentSettings = JSON.parse(business.settingsJson || "{}");

    currentSettings.notifications = {
      customerMessages: Boolean(notifications.customerMessages),
      newOrders: Boolean(notifications.newOrders),
      paymentUpdates: Boolean(notifications.paymentUpdates),
      orderStatus: Boolean(notifications.orderStatus),
      lowStock: Boolean(notifications.lowStock),
      trialReminders: true, // Always required
      subscription: true, // Always required
      securityAlerts: true, // Always required
    };

    await prisma.business.update({
      where: { id: business.id },
      data: { settingsJson: JSON.stringify(currentSettings) },
    });

    return NextResponse.json({
      status: "success",
      message: "Your notification preferences have been saved.",
      notifications: currentSettings.notifications,
    });
  } catch (error: any) {
    console.error("Update notifications error:", error);
    return NextResponse.json(
      { error: "We couldn't update your notification preferences. Please try again." },
      { status: 500 }
    );
  }
}
