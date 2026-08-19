import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/api-guard";

/**
 * PUT /api/settings/communication
 * 
 * Updates customer communication channel preferences in Business.settingsJson:
 * Controls optional messaging and notification alerts for Facebook, Instagram, WhatsApp, TikTok.
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
    const { communication } = body;

    if (!communication || typeof communication !== "object") {
      return NextResponse.json({ error: "Invalid communication preferences." }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { id: user.businessId },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const currentSettings = JSON.parse(business.settingsJson || "{}");

    currentSettings.communication = {
      facebook: Boolean(communication.facebook),
      instagram: Boolean(communication.instagram),
      whatsapp: Boolean(communication.whatsapp),
      tiktok: Boolean(communication.tiktok),
    };

    await prisma.business.update({
      where: { id: business.id },
      data: { settingsJson: JSON.stringify(currentSettings) },
    });

    return NextResponse.json({
      status: "success",
      message: "Your communication preferences have been saved.",
      communication: currentSettings.communication,
    });
  } catch (error: any) {
    console.error("Update communication error:", error);
    return NextResponse.json(
      { error: "We couldn't update your communication preferences. Please try again." },
      { status: 500 }
    );
  }
}
