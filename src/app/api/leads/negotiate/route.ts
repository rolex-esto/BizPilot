import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const {
      leadId,
      customerId,
      productId,
      action, // MAKE_OFFER, COUNTER_OFFER, ACCEPT_OFFER, REJECT_OFFER
      offerAmount,
      note,
    } = body;

    let lead = null;
    if (leadId) {
      lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: { interestedProduct: true, customer: true },
      });
    } else if (customerId) {
      lead = await prisma.lead.findFirst({
        where: {
          customerId,
          ...(productId ? { interestedProductId: productId } : {}),
          status: { in: ["NEW", "INTERESTED", "NEGOTIATING", "WAITING_FOR_CUSTOMER"] },
        },
        include: { interestedProduct: true, customer: true },
      });
    }

    if (!lead && customerId) {
      // Auto-create lead for this negotiation if not existing
      const cust = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!cust) {
        return NextResponse.json({ error: "Customer not found." }, { status: 404 });
      }

      if (user?.role !== "ADMIN" && cust.businessId !== businessId) {
        return NextResponse.json({ error: "Unauthorized access to customer." }, { status: 403 });
      }

      let originalPrice: number | undefined;
      if (productId) {
        const prod = await prisma.product.findUnique({ where: { id: productId } });
        if (prod) originalPrice = prod.price;
      }

      lead = await prisma.lead.create({
        data: {
          businessId: cust.businessId,
          customerId: cust.id,
          interestedProductId: productId || null,
          detectedIntent: "PRICE_INQUIRY",
          intentScore: 85,
          status: "NEGOTIATING",
          originalPrice: originalPrice || null,
          estimatedValue: originalPrice || offerAmount || null,
        },
        include: { interestedProduct: true, customer: true },
      });
    }

    if (!lead) {
      return NextResponse.json({ error: "Lead record not found." }, { status: 404 });
    }

    if (user?.role !== "ADMIN" && lead.businessId !== businessId) {
      return NextResponse.json({ error: "Unauthorized access to lead." }, { status: 403 });
    }

    const numAmount = Number(offerAmount);
    if (isNaN(numAmount) || numAmount < 0) {
      return NextResponse.json({ error: "Offer amount must be a valid non-negative number." }, { status: 400 });
    }

    // Parse existing negotiation history
    let history: Array<{ timestamp: string; party: string; amount: number; note?: string }> = [];
    if (lead.negotiationHistoryJson) {
      try {
        history = JSON.parse(lead.negotiationHistoryJson);
      } catch {
        history = [];
      }
    }

    const eventParty = action === "MAKE_OFFER" ? "CUSTOMER" : "OWNER";
    history.push({
      timestamp: new Date().toISOString(),
      party: eventParty,
      amount: numAmount,
      note: note || undefined,
    });

    let updatedStatus = lead.status;
    let agreedPrice = lead.agreedPrice;
    let offeredPrice = lead.offeredPrice;
    let counterPrice = lead.counterPrice;

    if (action === "ACCEPT_OFFER") {
      updatedStatus = "AGREED";
      agreedPrice = numAmount;
    } else if (action === "MAKE_OFFER") {
      updatedStatus = "NEGOTIATING";
      offeredPrice = numAmount;
    } else if (action === "COUNTER_OFFER") {
      updatedStatus = "NEGOTIATING";
      counterPrice = numAmount;
    } else if (action === "REJECT_OFFER") {
      updatedStatus = "LOST";
    }

    const updatedLead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: updatedStatus,
        offeredPrice,
        counterPrice,
        agreedPrice,
        estimatedValue: agreedPrice || counterPrice || offeredPrice || lead.estimatedValue,
        negotiationNotes: note || lead.negotiationNotes,
        negotiationHistoryJson: JSON.stringify(history),
      },
      include: {
        interestedProduct: true,
        customer: true,
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        businessId: lead.businessId,
        action: `NEGOTIATION_${action}`,
        entityType: "Lead",
        entityId: lead.id,
        details: `${eventParty} ${action.toLowerCase().replace("_", " ")}: ₱${numAmount} for ${
          lead.interestedProduct?.name || "inquiry"
        } (Customer: ${lead.customer.name})`,
        performedBy: eventParty === "OWNER" ? "OWNER" : "CUSTOMER",
      },
    });

    return NextResponse.json({
      status: "success",
      lead: updatedLead,
      negotiationHistory: history,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
