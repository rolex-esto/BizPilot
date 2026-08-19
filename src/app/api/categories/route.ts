import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/api-guard";
import { checkFeatureAccess } from "@/lib/auth/plan-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/categories
 * Returns all categories for the authenticated user's business.
 * Includes product count per category.
 */
export async function GET(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;
    const authenticatedUser = user!;

    if (!authenticatedUser.businessId) {
      return NextResponse.json({ status: "success", categories: [] });
    }

    const categories = await prisma.category.findMany({
      where: { businessId: authenticatedUser.businessId },
      orderBy: { name: "asc" },
    });

    // Get product counts per category name
    const products = await prisma.product.groupBy({
      by: ["category"],
      where: { businessId: authenticatedUser.businessId, isActive: true },
      _count: { id: true },
    });

    const productCountMap = new Map(products.map((p) => [p.category, p._count.id]));

    const categoriesWithCounts = categories.map((cat) => ({
      ...cat,
      productCount: productCountMap.get(cat.name) || 0,
    }));

    return NextResponse.json({ status: "success", categories: categoriesWithCounts });
  } catch (error: any) {
    console.error("Categories GET error:", error);
    return NextResponse.json({ error: "Failed to load categories." }, { status: 500 });
  }
}

/**
 * POST /api/categories
 * Creates a new category for the authenticated user's business.
 * Duplicate names (case-insensitive) are rejected.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;
    const authenticatedUser = user!;

    if (!authenticatedUser.businessId) {
      return NextResponse.json({ error: "No business linked to your account." }, { status: 400 });
    }

    // Plan feature enforcement: category management requires Business plan or higher
    const featureError = await checkFeatureAccess(
      authenticatedUser.businessId,
      "categoryManagement",
      "Category management"
    );
    if (featureError) return featureError;

    const body = await req.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Please enter a category name." }, { status: 400 });
    }

    const cleanName = name.trim();

    // Check for case-insensitive duplicate
    const existing = await prisma.category.findMany({
      where: { businessId: authenticatedUser.businessId },
    });

    const duplicate = existing.find(
      (cat) => cat.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (duplicate) {
      return NextResponse.json(
        { error: `A category named "${duplicate.name}" already exists.` },
        { status: 409 }
      );
    }

    const category = await prisma.category.create({
      data: {
        businessId: authenticatedUser.businessId,
        name: cleanName,
        description: description?.trim() || null,
      },
    });

    return NextResponse.json({ status: "success", category }, { status: 201 });
  } catch (error: any) {
    console.error("Categories POST error:", error);
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "This category already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create category." }, { status: 500 });
  }
}
