import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkProductLimit } from "@/lib/auth/plan-guard";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    if (!businessId) {
      return NextResponse.json({ status: "success", products: [] });
    }

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const products = await prisma.product.findMany({
      where: {
        businessId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ status: "success", products });
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

    // Plan limit enforcement: check product count against plan
    const limitError = await checkProductLimit(businessId);
    if (limitError) return limitError;

    let {
      sku,
      name,
      description,
      category,
      price,
      costPrice,
      stockQuantity,
      safetyStockThreshold,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Product name is required." }, { status: 400 });
    }

    // Auto-generate SKU if not provided
    if (!sku || typeof sku !== "string" || !sku.trim()) {
      const prefix = name.trim().substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "X");
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      sku = `${prefix}-${random}`;
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return NextResponse.json({ error: "Price must be a valid non-negative number." }, { status: 400 });
    }

    const numStock = Number(stockQuantity ?? 0);
    if (isNaN(numStock) || numStock < 0) {
      return NextResponse.json({ error: "Stock quantity cannot be negative." }, { status: 400 });
    }

    const numThreshold = Number(safetyStockThreshold ?? 2);
    if (isNaN(numThreshold) || numThreshold < 0) {
      return NextResponse.json({ error: "Safety stock threshold cannot be negative." }, { status: 400 });
    }

    const numCostPrice = costPrice !== undefined && costPrice !== null && costPrice !== "" ? Number(costPrice) : undefined;
    if (numCostPrice !== undefined && (isNaN(numCostPrice) || numCostPrice < 0)) {
      return NextResponse.json({ error: "Cost price cannot be negative." }, { status: 400 });
    }

    // Check SKU uniqueness within business
    const existingSku = await prisma.product.findUnique({
      where: {
        businessId_sku: {
          businessId,
          sku: sku.trim(),
        },
      },
    });

    if (existingSku) {
      return NextResponse.json({ error: `Product with SKU "${sku}" already exists for this business.` }, { status: 409 });
    }

    const product = await prisma.product.create({
      data: {
        businessId,
        sku: sku.trim(),
        name: name.trim(),
        description: description?.trim() || null,
        category: category?.trim() || "General",
        price: numPrice,
        costPrice: numCostPrice ?? null,
        stockQuantity: numStock,
        safetyStockThreshold: numThreshold,
        imageUrl: body.imageUrl?.trim() || null,
        isActive: true,
      },
    });

    return NextResponse.json({ status: "success", product }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
