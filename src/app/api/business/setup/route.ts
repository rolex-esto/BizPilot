import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/api-guard";

export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;
    // user is guaranteed non-null after the guard check
    const authenticatedUser = user!;

    const body = await req.json();
    const { name, ownerName, email, contactNumber, address, operatingHours, fulfillmentOptions, acceptedPayments } = body;

    if (!name || !ownerName) {
      return NextResponse.json({ error: "Business name and owner name are required" }, { status: 400 });
    }

    const settingsJson = JSON.stringify({
      businessModel: "ONLINE_ONLY",
      hasPhysicalStore: false,
      autoSuggestReplies: true,
      operatingHours: operatingHours || "Daily 8:00 AM - 10:00 PM",
      fulfillmentOptions: fulfillmentOptions || ["MEETUP", "LBC", "COURIER", "DELIVERY"],
      acceptedPaymentMethods: acceptedPayments || ["GCASH", "MAYA", "BANK_TRANSFER", "COD", "CASH"],
    });

    const newBusiness = await prisma.business.create({
      data: {
        name,
        ownerName,
        email: email || authenticatedUser.email,
        contactNumber,
        address: address || "Online Operations Hub, Metro Manila",
        settingsJson,
      },
    });

    // Link business to user if user is an owner
    if (authenticatedUser.role === "OWNER") {
      await prisma.user.update({
        where: { id: authenticatedUser.id },
        data: { businessId: newBusiness.id },
      });
    }

    return NextResponse.json({
      status: "success",
      business: newBusiness,
    });
  } catch (error: any) {
    console.error("Business setup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
