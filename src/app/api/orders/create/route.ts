import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkOrderLimit } from "@/lib/auth/plan-guard";
import { requireBusinessAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { user, businessId: authenticatedBizId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const {
      customerId,
      conversationId,
      items, // Array of { productId, quantity, agreedUnitPrice?, discount? }
      fulfillmentMethod, // MEETUP, LBC, COURIER, PICKUP, DELIVERY, OTHER
      source, // WALK_IN, PHONE, REFERRAL, FACEBOOK, INSTAGRAM, WHATSAPP, TIKTOK, MANUAL
      deliveryAddress,
      customerPhone,
      courier,
      courierTracking,
      shippingFee,
      meetupSchedule,
      meetupLocation,
      pickupSchedule,
      pickupLocation,
      paymentMethod, // GCASH, MAYA, BANK_TRANSFER, CASH, COD
      isImmediatePaid, // boolean for walk-in cash settlement
      paymentReference,
      notes,
    } = body;

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Customer and at least one item are required." }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }

    // Strict multi-tenant verification: Ensure customer belongs to authenticated business
    const businessId = authenticatedBizId || customer.businessId;
    if (user?.role !== "ADMIN" && customer.businessId !== businessId) {
      return NextResponse.json({ error: "Unauthorized: Customer does not belong to your business." }, { status: 403 });
    }

    // Resolve Environment
    const environment = customer.environment === "PRACTICE" || body.environment === "PRACTICE" ? "PRACTICE" : "LIVE";

    // Plan limit enforcement: only applies to LIVE production orders
    if (environment === "LIVE") {
      const orderLimitError = await checkOrderLimit(businessId);
      if (orderLimitError) return orderLimitError;
    }

    // Fetch verified products from DB to ensure prices are grounded and strictly belong to this business
    const productIds = items.map((i: any) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    let catalogTotalAmount = 0;
    let finalTotalAmount = 0;
    const orderItemsData = [];

    for (const item of items) {
      const p = productMap.get(item.productId);
      if (!p) {
        return NextResponse.json({ error: `Product ID ${item.productId} not found in inventory or does not belong to this business.` }, { status: 404 });
      }

      const qty = parseInt(item.quantity) || 1;
      const catalogUnitPrice = p.price; // Authoritative immutable catalog price
      
      // Determine final agreed unit price
      let effectiveUnitPrice = catalogUnitPrice;
      let unitDiscount = 0;

      if (item.agreedUnitPrice !== undefined && item.agreedUnitPrice !== null) {
        const parsedAgreed = Number(item.agreedUnitPrice);
        if (!isNaN(parsedAgreed) && parsedAgreed >= 0) {
          effectiveUnitPrice = parsedAgreed;
          unitDiscount = Math.max(0, catalogUnitPrice - effectiveUnitPrice);
        }
      } else if (item.discount !== undefined && item.discount !== null) {
        const parsedDiscount = Number(item.discount);
        if (!isNaN(parsedDiscount) && parsedDiscount >= 0) {
          unitDiscount = parsedDiscount;
          effectiveUnitPrice = Math.max(0, catalogUnitPrice - unitDiscount);
        }
      }

      const catalogSubtotal = catalogUnitPrice * qty;
      const finalSubtotal = effectiveUnitPrice * qty;

      catalogTotalAmount += catalogSubtotal;
      finalTotalAmount += finalSubtotal;

      orderItemsData.push({
        productId: p.id,
        productName: p.name,
        productSku: p.sku,
        originalUnitPrice: catalogUnitPrice,
        discount: unitDiscount,
        unitPrice: effectiveUnitPrice,
        quantity: qty,
        subtotal: finalSubtotal,
      });
    }

    const totalDiscount = Math.max(0, catalogTotalAmount - finalTotalAmount);
    const shippingAmount = Number(shippingFee) || 0;
    const grandTotal = finalTotalAmount + shippingAmount;

    // Generate unique order number (concurrency-safe)
    const count = await prisma.order.count({ where: { businessId } });
    const prefix = environment === "PRACTICE" ? "SIM" : "ORD";

    const effectiveFulfillment = fulfillmentMethod || (courier === "LBC" ? "LBC" : "DELIVERY");
    const effectivePaymentMethod = paymentMethod || "GCASH";
    const orderSource = source || customer.source || (environment === "PRACTICE" ? "SIMULATOR" : "ONLINE");

    let paymentInitialStatus = "UNPAID";
    let verifiedAtDate: Date | null = null;

    if (effectivePaymentMethod === "CASH" && isImmediatePaid) {
      paymentInitialStatus = "PAID";
      verifiedAtDate = new Date();
    } else if (effectivePaymentMethod === "COD") {
      paymentInitialStatus = "UNPAID"; // COD must NEVER be marked paid prematurely
    } else if (paymentReference) {
      paymentInitialStatus = "PENDING_VERIFICATION";
    }

    // Create Order and Payment transactionally with retry on orderNumber race condition
    let order;
    let attempt = 0;
    while (attempt < 3) {
      attempt++;
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const orderNumber = `${prefix}-2026-${String(count + attempt).padStart(3, "0")}-${randomSuffix}`;
      try {
        order = await prisma.order.create({
          data: {
            businessId,
            customerId,
            conversationId,
            environment,
            orderNumber,
            totalAmount: grandTotal,
            originalAmount: catalogTotalAmount,
            discountAmount: totalDiscount,
            source: orderSource,
            fulfillmentMethod: effectiveFulfillment,
            status: effectivePaymentMethod === "CASH" && isImmediatePaid ? "CONFIRMED" : "PENDING",
            deliveryAddress: deliveryAddress || customer.deliveryAddress,
            customerPhone: customerPhone || customer.phone,
            courier: courier || (effectiveFulfillment === "LBC" ? "LBC" : "Lalamove"),
            trackingNumber: courierTracking || null,
            courierTracking: courierTracking || null,
            shippingFee: shippingAmount,
            meetupSchedule: meetupSchedule ? new Date(meetupSchedule) : null,
            meetupLocation: meetupLocation || null,
            meetupStatus: effectiveFulfillment === "MEETUP" ? "SCHEDULED" : null,
            pickupSchedule: pickupSchedule ? new Date(pickupSchedule) : null,
            pickupLocation: pickupLocation || null,
            pickupStatus: effectiveFulfillment === "PICKUP" ? "READY_FOR_PICKUP" : null,
            notes: notes || null,
            items: {
              create: orderItemsData,
            },
            payments: {
              create: [
                {
                  businessId,
                  customerId,
                  environment,
                  paymentMethod: effectivePaymentMethod,
                  amount: grandTotal,
                  status: paymentInitialStatus,
                  referenceNumber: paymentReference || (effectivePaymentMethod === "CASH" ? "CASH-PAID" : null),
                  verifiedAt: verifiedAtDate,
                },
              ],
            },
          },
          include: {
            items: true,
            payments: true,
          },
        });
        break;
      } catch (err: any) {
        if (err.code === "P2002" && attempt < 3) {
          continue;
        }
        throw err;
      }
    }

    if (!order) {
      return NextResponse.json({ error: "Failed to create order after retries" }, { status: 500 });
    }

    // If immediate paid cash for LIVE order, decrement inventory atomically (NEVER for PRACTICE)
    if (environment === "LIVE" && effectivePaymentMethod === "CASH" && isImmediatePaid) {
      for (const item of orderItemsData) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }
    }

    // Update Customer stats and Lead status to CONVERTED
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        leadStatus: "CONVERTED",
        leadScore: 100,
        orderCount: { increment: 1 },
        lifetimeValue: environment === "LIVE" && effectivePaymentMethod === "CASH" && isImmediatePaid
          ? { increment: grandTotal }
          : undefined,
        deliveryAddress: deliveryAddress || customer.deliveryAddress,
        phone: customerPhone || customer.phone,
        preferredFulfillment: effectiveFulfillment,
      },
    });

    // If there's an active Lead record for this customer, mark it as CONVERTED
    await prisma.lead.updateMany({
      where: { customerId, environment, status: { in: ["NEW", "INTERESTED", "NEGOTIATING", "WAITING_FOR_CUSTOMER", "AGREED"] } },
      data: { status: "CONVERTED", agreedPrice: finalTotalAmount },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        businessId,
        action: environment === "PRACTICE" ? "PRACTICE_ORDER_CREATED" : "ORDER_CREATED",
        entityType: "Order",
        entityId: order.id,
        details: `Created ${environment === "PRACTICE" ? "practice " : ""}order ${order.orderNumber} for ${customer.name} (Fulfillment: ${effectiveFulfillment}, Total: ₱${grandTotal}, Discount: ₱${totalDiscount})`,
        performedBy: user?.role === "ADMIN" ? "ADMIN" : "OWNER",
      },
    });

    return NextResponse.json({
      status: "success",
      order,
    });
  } catch (error: any) {
    console.error("Order creation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
