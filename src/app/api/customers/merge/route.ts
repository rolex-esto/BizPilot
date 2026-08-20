import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { primaryCustomerId, secondaryCustomerId } = body;

    if (!primaryCustomerId || !secondaryCustomerId || primaryCustomerId === secondaryCustomerId) {
      return NextResponse.json({ error: "Two distinct customer IDs are required." }, { status: 400 });
    }

    const [primary, secondary] = await Promise.all([
      prisma.customer.findUnique({ where: { id: primaryCustomerId } }),
      prisma.customer.findUnique({ where: { id: secondaryCustomerId } }),
    ]);

    if (!primary || !secondary) {
      return NextResponse.json({ error: "One or both customers not found." }, { status: 404 });
    }

    // Strict multi-tenant check: Both customers must belong to the authenticated user's business
    if (user?.role !== "ADMIN" && (primary.businessId !== businessId || secondary.businessId !== businessId)) {
      return NextResponse.json({ error: "Unauthorized access to customers." }, { status: 403 });
    }

    // Move conversations, messages, orders, leads, and create identity link
    await prisma.$transaction(async (tx) => {
      // 1. Move conversations
      await tx.conversation.updateMany({
        where: { customerId: secondary.id },
        data: { customerId: primary.id },
      });

      // 2. Move messages
      await tx.message.updateMany({
        where: { customerId: secondary.id },
        data: { customerId: primary.id },
      });

      // 3. Move orders
      await tx.order.updateMany({
        where: { customerId: secondary.id },
        data: { customerId: primary.id },
      });

      // 4. Move payments
      await tx.payment.updateMany({
        where: { customerId: secondary.id },
        data: { customerId: primary.id },
      });

      // 5. Move leads
      await tx.lead.updateMany({
        where: { customerId: secondary.id },
        data: { customerId: primary.id },
      });

      // 6. Record identity link
      if (secondary.externalId) {
        await tx.customerIdentityLink.create({
          data: {
            businessId: primary.businessId,
            customerId: primary.id,
            platform: secondary.primaryPlatform,
            externalId: secondary.externalId,
            externalName: secondary.name,
            handle: secondary.handle,
          },
        });
      }

      // 7. Update primary stats
      await tx.customer.update({
        where: { id: primary.id },
        data: {
          lifetimeValue: primary.lifetimeValue + secondary.lifetimeValue,
          orderCount: primary.orderCount + secondary.orderCount,
          phone: primary.phone || secondary.phone,
          deliveryAddress: primary.deliveryAddress || secondary.deliveryAddress,
          email: primary.email || secondary.email,
        },
      });

      // 8. Delete secondary customer profile
      await tx.customer.delete({ where: { id: secondary.id } });

      // 9. Audit Log
      await tx.auditLog.create({
        data: {
          businessId: primary.businessId,
          action: "CUSTOMERS_MERGED",
          entityType: "Customer",
          entityId: primary.id,
          details: `Merged secondary profile (${secondary.name}, ${secondary.primaryPlatform}) into primary profile (${primary.name}).`,
          performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
        },
      });
    });

    return NextResponse.json({
      status: "success",
      message: `Successfully linked and merged profiles for ${primary.name}.`,
    });
  } catch (error: any) {
    console.error("Customer merge error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
