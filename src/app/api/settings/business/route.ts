import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/api-guard";

/**
 * PUT /api/settings/business
 * 
 * Updates the business profile:
 * - Business name
 * - Description
 * - Category
 * - Business Type (ONLINE_ONLY, PHYSICAL_STORE, HYBRID)
 * - Phone & Business Email
 * - Hub / Operations Address
 * - Business Logo URL
 * - Fulfillment Methods (Meetup, LBC, Grab, Lalamove, Delivery)
 * - Accepted Payment Methods (GCash, Maya, Bank Transfer, COD, Cash)
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
      return NextResponse.json({ error: "No business profile found for this account." }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      description,
      category,
      businessType,
      contactNumber,
      email,
      address,
      logoUrl,
      fulfillmentMethods,
      acceptedPaymentMethods,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Please enter your business name." }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { id: user.businessId },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const currentSettings = JSON.parse(business.settingsJson || "{}");

    // Update settingsJson
    currentSettings.description = description ? description.trim() : "";
    currentSettings.category = category ? category.trim() : "General Retail";
    currentSettings.businessType = businessType || "ONLINE_ONLY";
    currentSettings.logoUrl = logoUrl || null;
    currentSettings.fulfillmentOptions = Array.isArray(fulfillmentMethods)
      ? fulfillmentMethods
      : ["MEETUP", "LBC", "GRAB", "LALAMOVE", "DELIVERY"];
    currentSettings.acceptedPaymentMethods = Array.isArray(acceptedPaymentMethods)
      ? acceptedPaymentMethods
      : ["GCASH", "MAYA", "BANK_TRANSFER", "COD", "CASH"];

    // Update database record
    const updatedBusiness = await prisma.business.update({
      where: { id: business.id },
      data: {
        name: name.trim(),
        contactNumber: contactNumber ? contactNumber.trim() : business.contactNumber,
        email: email ? email.trim().toLowerCase() : business.email,
        address: address ? address.trim() : business.address,
        settingsJson: JSON.stringify(currentSettings),
      },
    });

    return NextResponse.json({
      status: "success",
      message: "Your business information has been updated.",
      business: updatedBusiness,
    });
  } catch (error: any) {
    console.error("Update business settings error:", error);
    return NextResponse.json(
      { error: "We couldn't save your business profile changes. Please try again." },
      { status: 500 }
    );
  }
}
