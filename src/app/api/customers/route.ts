import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    if (!businessId) {
      return NextResponse.json({ status: "success", customers: [] });
    }

    const envParam = req.nextUrl.searchParams.get("environment") || req.nextUrl.searchParams.get("mode");
    const environment = envParam?.toUpperCase() === "PRACTICE" ? "PRACTICE" : "LIVE";

    const customers = await prisma.customer.findMany({
      where: { businessId, environment },
      include: {
        orders: {
          where: { environment },
          include: { items: true, payments: true },
          orderBy: { createdAt: "desc" },
        },
        leads: {
          where: { environment },
          include: { interestedProduct: true },
          orderBy: { createdAt: "desc" },
        },
        identityLinks: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ status: "success", customers });
  } catch (error: any) {
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

    let {
      name,
      phone,
      email,
      deliveryAddress,
      source,
      preferredFulfillment,
      notes,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
    }

    const customerSource = source?.trim() || "MANUAL";
    const primaryPlatform = ["FACEBOOK", "INSTAGRAM", "WHATSAPP", "TIKTOK"].includes(customerSource)
      ? customerSource
      : "MANUAL";

    const customer = await prisma.customer.create({
      data: {
        businessId,
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        deliveryAddress: deliveryAddress?.trim() || null,
        source: customerSource,
        primaryPlatform,
        preferredFulfillment: preferredFulfillment?.trim() || null,
        notes: notes?.trim() || null,
        leadScore: 60,
        leadStatus: "WARM",
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        businessId,
        action: "CUSTOMER_CREATED",
        entityType: "Customer",
        entityId: customer.id,
        details: `Created manual/offline customer: ${customer.name} (Source: ${customerSource})`,
        performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
      },
    });

    return NextResponse.json({ status: "success", customer }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
