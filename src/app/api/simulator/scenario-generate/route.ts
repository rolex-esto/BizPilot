import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";
import { CustomerPersonaEngine } from "@/lib/simulator/customer-persona-engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/simulator/scenario-generate
 * 
 * Dynamically generates realistic practice scenarios using the business's
 * active product catalog and store settings.
 */
export async function GET(req: NextRequest) {
  try {
    const { businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse || !businessId) {
      return errorResponse || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        settingsJson: true,
        products: {
          where: { isActive: true },
          select: { id: true, name: true, sku: true, price: true, stockQuantity: true, category: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const parsedSettings = business.settingsJson ? JSON.parse(business.settingsJson) : {};
    const scenarios = CustomerPersonaEngine.generateScenariosFromCatalog(
      business.products,
      parsedSettings
    );

    return NextResponse.json({
      status: "success",
      products: business.products,
      scenarios,
    });
  } catch (error: any) {
    console.error("Error generating scenarios:", error);
    return NextResponse.json({ error: error.message || "Failed to generate scenarios" }, { status: 500 });
  }
}
