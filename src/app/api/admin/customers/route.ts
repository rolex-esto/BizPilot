import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/api-guard";
import { getActiveSupportSession, maskName, maskPhone, maskEmail } from "@/lib/auth/support-session";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/customers
 * Returns customer directory across businesses with privacy-first masking.
 * Private contact details are masked unless an active Support Session is open.
 */
export async function GET(req: NextRequest) {
  try {
    const { user: currentAdmin, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.toLowerCase().trim() || "";
    const businessId = url.searchParams.get("businessId") || "";

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { business: { name: { contains: search } } },
      ];
    }
    if (businessId) {
      where.businessId = businessId;
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        business: {
          select: { id: true, name: true, ownerName: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    // Check active support sessions
    const businessIds = Array.from(new Set(customers.map((c) => c.businessId)));
    const activeSessions = await Promise.all(
      businessIds.map((bId) => getActiveSupportSession(currentAdmin!.id, bId))
    );
    const authorizedBusinessIds = new Set(
      activeSessions.filter(Boolean).map((s) => s!.businessId)
    );

    const privacySafeCustomers = customers.map((c) => {
      const isAuthorized = authorizedBusinessIds.has(c.businessId);

      return {
        id: c.id,
        businessId: c.businessId,
        business: c.business,
        primaryPlatform: c.primaryPlatform,
        lifetimeValue: c.lifetimeValue,
        orderCount: c.orderCount,
        hasSupportAccess: isAuthorized,
        // Masked Fields:
        name: isAuthorized ? c.name : maskName(c.name),
        phone: isAuthorized ? c.phone : maskPhone(c.phone),
        email: isAuthorized ? c.email : maskEmail(c.email),
        updatedAt: c.updatedAt,
      };
    });

    const totalCustomers = await prisma.customer.count();

    return NextResponse.json({
      status: "success",
      summary: {
        totalCustomers,
      },
      customers: privacySafeCustomers,
    });
  } catch (error: any) {
    console.error("Admin list customers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
