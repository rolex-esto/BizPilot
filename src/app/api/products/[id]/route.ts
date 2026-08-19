import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const product = await prisma.product.findUnique({
      where: { id: params.id },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    if (user?.role !== "ADMIN" && product.businessId !== businessId) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json({ status: "success", product });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const existing = await prisma.product.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    if (user?.role !== "ADMIN" && existing.businessId !== businessId) {
      return NextResponse.json({ error: "Unauthorized access to product." }, { status: 403 });
    }

    const dataToUpdate: any = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json({ error: "Product name cannot be empty." }, { status: 400 });
      }
      dataToUpdate.name = body.name.trim();
    }

    if (body.sku !== undefined && body.sku !== existing.sku) {
      if (typeof body.sku !== "string" || !body.sku.trim()) {
        return NextResponse.json({ error: "SKU cannot be empty." }, { status: 400 });
      }
      const duplicateSku = await prisma.product.findUnique({
        where: {
          businessId_sku: {
            businessId: existing.businessId,
            sku: body.sku.trim(),
          },
        },
      });
      if (duplicateSku && duplicateSku.id !== existing.id) {
        return NextResponse.json({ error: `SKU "${body.sku}" is already in use by another product.` }, { status: 409 });
      }
      dataToUpdate.sku = body.sku.trim();
    }

    if (body.category !== undefined) {
      dataToUpdate.category = typeof body.category === "string" ? body.category.trim() : existing.category;
    }

    if (body.description !== undefined) {
      dataToUpdate.description = body.description ? String(body.description).trim() : null;
    }

    if (body.price !== undefined) {
      const numPrice = Number(body.price);
      if (isNaN(numPrice) || numPrice < 0) {
        return NextResponse.json({ error: "Price must be a valid non-negative number." }, { status: 400 });
      }
      dataToUpdate.price = numPrice;
    }

    if (body.costPrice !== undefined) {
      if (body.costPrice === null || body.costPrice === "") {
        dataToUpdate.costPrice = null;
      } else {
        const numCost = Number(body.costPrice);
        if (isNaN(numCost) || numCost < 0) {
          return NextResponse.json({ error: "Cost price cannot be negative." }, { status: 400 });
        }
        dataToUpdate.costPrice = numCost;
      }
    }

    if (body.stockQuantity !== undefined) {
      const numStock = Number(body.stockQuantity);
      if (isNaN(numStock) || numStock < 0) {
        return NextResponse.json({ error: "Stock quantity cannot be negative." }, { status: 400 });
      }
      dataToUpdate.stockQuantity = numStock;
    }

    if (body.safetyStockThreshold !== undefined) {
      const numThreshold = Number(body.safetyStockThreshold);
      if (isNaN(numThreshold) || numThreshold < 0) {
        return NextResponse.json({ error: "Safety stock threshold cannot be negative." }, { status: 400 });
      }
      dataToUpdate.safetyStockThreshold = numThreshold;
    }

    if (body.isActive !== undefined) {
      dataToUpdate.isActive = Boolean(body.isActive);
    }

    if (body.imageUrl !== undefined) {
      dataToUpdate.imageUrl = body.imageUrl?.trim() || null;
    }

    const updated = await prisma.product.update({
      where: { id: params.id },
      data: dataToUpdate,
    });

    return NextResponse.json({ status: "success", product: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const existing = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        orderItems: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    if (user?.role !== "ADMIN" && existing.businessId !== businessId) {
      return NextResponse.json({ error: "Unauthorized access to product." }, { status: 403 });
    }

    // If product is referenced by existing order items, soft deactivate to preserve order history
    if (existing.orderItems.length > 0) {
      const deactivated = await prisma.product.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      return NextResponse.json({
        status: "success",
        deactivated: true,
        message: "Product deactivated (archived) to preserve historical customer order records.",
        product: deactivated,
      });
    }

    // Otherwise, safe to permanently delete
    await prisma.product.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      status: "success",
      deleted: true,
      message: "Product permanently removed.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
