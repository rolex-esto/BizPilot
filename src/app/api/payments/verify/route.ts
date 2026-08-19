import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { paymentId, status, referenceNumber, notes } = body;

    if (!paymentId || !status) {
      return NextResponse.json({ error: "paymentId and status are required" }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true, customer: true },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (user?.role !== "ADMIN" && payment.businessId !== businessId) {
      return NextResponse.json({ error: "Unauthorized access to payment." }, { status: 403 });
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status, // PAID, PENDING_VERIFICATION, FAILED
        referenceNumber: referenceNumber || payment.referenceNumber,
        notes: notes || payment.notes,
        verifiedAt: status === "PAID" ? new Date() : null,
      },
    });

    // If marked PAID, update customer lifetime value
    if (status === "PAID" && payment.status !== "PAID") {
      await prisma.customer.update({
        where: { id: payment.customerId },
        data: {
          lifetimeValue: { increment: payment.amount },
        },
      });

      // Also check if order can be marked confirmed or packed if pending
      if (payment.order.status === "PENDING") {
        await prisma.order.update({
          where: { id: payment.orderId },
          data: { status: "CONFIRMED" },
        });
      }
    }

    // Audit Log
    await prisma.auditLog.create({
      data: {
        businessId: payment.businessId,
        action: "PAYMENT_STATUS_UPDATED",
        entityType: "Payment",
        entityId: payment.id,
        details: `Updated payment status to ${status} for Order ${payment.order.orderNumber} (Amount: ₱${payment.amount}, Ref: ${referenceNumber || "N/A"})`,
        performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
      },
    });

    return NextResponse.json({
      status: "success",
      payment: updatedPayment,
    });
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
