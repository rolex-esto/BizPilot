import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    if (!businessId) {
      return NextResponse.json({ status: "success", connections: [] });
    }

    const connections = await prisma.calendarConnection.findMany({
      where: { businessId },
      select: {
        id: true,
        businessId: true,
        provider: true,
        accountEmail: true,
        accountName: true,
        status: true,
        calendarId: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ status: "success", connections });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, businessId: authBizId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    let { businessId: reqBizId, provider, accountEmail, accountName, accessToken } = body;
    const businessId = authBizId || reqBizId;

    if (!businessId || !accountEmail) {
      return NextResponse.json({ error: "businessId and accountEmail are required." }, { status: 400 });
    }

    const targetProvider = (provider || "GOOGLE").toUpperCase();

    const connection = await prisma.calendarConnection.upsert({
      where: {
        businessId_provider: {
          businessId,
          provider: targetProvider,
        },
      },
      update: {
        accountEmail: accountEmail.trim(),
        accountName: accountName?.trim() || "Owner Calendar",
        accessTokenEncrypted: accessToken || `sample_token_${Date.now()}`,
        status: "CONNECTED",
        updatedAt: new Date(),
      },
      create: {
        businessId,
        provider: targetProvider,
        accountEmail: accountEmail.trim(),
        accountName: accountName?.trim() || "Owner Calendar",
        accessTokenEncrypted: accessToken || `sample_token_${Date.now()}`,
        status: "CONNECTED",
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        businessId,
        action: "CALENDAR_CONNECTED",
        entityType: "CalendarConnection",
        entityId: connection.id,
        details: `Connected ${targetProvider} account: ${accountEmail}`,
        performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
      },
    });

    return NextResponse.json({ status: "success", connection });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, businessId: authBizId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider") || "GOOGLE";
    const businessId = authBizId || searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json({ error: "Business ID is required." }, { status: 400 });
    }

    await prisma.calendarConnection.deleteMany({
      where: {
        businessId,
        provider: provider.toUpperCase(),
      },
    });

    return NextResponse.json({ status: "success", message: "Calendar disconnected." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
