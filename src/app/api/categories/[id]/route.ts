import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/api-guard";
import { checkFeatureAccess } from "@/lib/auth/plan-guard";

/**
 * PATCH /api/categories/[id]
 * Updates a category name and/or description.
 * Validates ownership and duplicate names.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;
    const authenticatedUser = user!;

    const category = await prisma.category.findUnique({
      where: { id: params.id },
    });

    if (!category || category.businessId !== authenticatedUser.businessId) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    // Plan feature enforcement: category management requires Business plan or higher
    const featureError = await checkFeatureAccess(
      authenticatedUser.businessId!,
      "categoryManagement",
      "Category management"
    );
    if (featureError) return featureError;

    const body = await req.json();
    const { name, description } = body;

    const dataToUpdate: any = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "Category name cannot be empty." }, { status: 400 });
      }

      const cleanName = name.trim();

      // Check for case-insensitive duplicate (excluding self)
      const existing = await prisma.category.findMany({
        where: { businessId: authenticatedUser.businessId! },
      });
      const duplicate = existing.find(
        (cat) => cat.id !== params.id && cat.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicate) {
        return NextResponse.json(
          { error: `A category named "${duplicate.name}" already exists.` },
          { status: 409 }
        );
      }

      // Also update all products that used the old category name
      if (cleanName !== category.name) {
        await prisma.product.updateMany({
          where: { businessId: authenticatedUser.businessId!, category: category.name },
          data: { category: cleanName },
        });
      }

      dataToUpdate.name = cleanName;
    }

    if (description !== undefined) {
      dataToUpdate.description = description?.trim() || null;
    }

    const updated = await prisma.category.update({
      where: { id: params.id },
      data: dataToUpdate,
    });

    return NextResponse.json({ status: "success", category: updated });
  } catch (error: any) {
    console.error("Category PATCH error:", error);
    return NextResponse.json({ error: "Failed to update category." }, { status: 500 });
  }
}

/**
 * DELETE /api/categories/[id]
 * Deletes a category only if no products are currently using it.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;
    const authenticatedUser = user!;

    const category = await prisma.category.findUnique({
      where: { id: params.id },
    });

    if (!category || category.businessId !== authenticatedUser.businessId) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    // Plan feature enforcement: category management requires Business plan or higher
    const featureDeleteError = await checkFeatureAccess(
      authenticatedUser.businessId!,
      "categoryManagement",
      "Category management"
    );
    if (featureDeleteError) return featureDeleteError;

    // Check if any products are using this category
    const productCount = await prisma.product.count({
      where: { businessId: authenticatedUser.businessId!, category: category.name },
    });

    if (productCount > 0) {
      return NextResponse.json(
        {
          error: `This category can't be deleted because ${productCount} product${productCount > 1 ? "s are" : " is"} still assigned to it. Move them to another category first.`,
          productCount,
        },
        { status: 409 }
      );
    }

    await prisma.category.delete({ where: { id: params.id } });

    return NextResponse.json({ status: "success", message: "Category deleted." });
  } catch (error: any) {
    console.error("Category DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete category." }, { status: 500 });
  }
}
