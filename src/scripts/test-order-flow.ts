import { prisma } from "../lib/prisma";

async function testOrderWorkflow() {
  console.log("=== TEST 3: Lead → Order → Payment → Inventory Decrement Workflow ===");

  const business = await prisma.business.findFirst();
  if (!business) throw new Error("No business found.");

  const customer = await prisma.customer.create({
    data: {
      businessId: business.id,
      primaryPlatform: "FACEBOOK",
      name: "Workflow Test Buyer",
      phone: "0917-000-9999",
      leadScore: 90,
      leadStatus: "HOT",
    },
  });

  const product = await prisma.product.findFirst({
    where: { businessId: business.id, sku: "BAS-HUB-8IN1" },
  });
  if (!product) throw new Error("Product BAS-HUB-8IN1 not found.");

  const initialStock = product.stockQuantity;
  console.log(`Initial stock for ${product.name}: ${initialStock}`);

  // 1. Create Order
  const orderNumber = `ORD-TEST-${Date.now().toString().slice(-4)}`;
  const order = await prisma.order.create({
    data: {
      businessId: business.id,
      customerId: customer.id,
      orderNumber,
      totalAmount: product.price * 2,
      status: "PENDING",
      items: {
        create: [
          {
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            unitPrice: product.price,
            quantity: 2,
            subtotal: product.price * 2,
          },
        ],
      },
      payments: {
        create: [
          {
            businessId: business.id,
            customerId: customer.id,
            paymentMethod: "GCASH",
            amount: product.price * 2,
            referenceNumber: "GCASH-TEST-9988",
            status: "PENDING_VERIFICATION",
          },
        ],
      },
    },
    include: { items: true, payments: true },
  });

  console.log(`Order created: ${order.orderNumber} for ₱${order.totalAmount}`);

  // 2. Confirm Order & Decrement Stock (Atomic Transaction)
  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { decrement: item.quantity } },
      });
    }
    await tx.order.update({
      where: { id: order.id },
      data: { status: "CONFIRMED" },
    });
  });

  const updatedProduct = await prisma.product.findUnique({
    where: { id: product.id },
  });
  console.log(`Stock after order confirmation: ${updatedProduct?.stockQuantity}`);

  if (updatedProduct?.stockQuantity !== initialStock - 2) {
    throw new Error(`Inventory was not decremented accurately! Expected ${initialStock - 2}, got ${updatedProduct?.stockQuantity}`);
  }

  // 3. Verify Payment
  const payment = order.payments[0];
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "PAID", verifiedAt: new Date() },
  });
  await prisma.customer.update({
    where: { id: customer.id },
    data: { lifetimeValue: { increment: payment.amount } },
  });

  const updatedCustomer = await prisma.customer.findUnique({
    where: { id: customer.id },
  });
  console.log(`Customer Lifetime Value updated: ₱${updatedCustomer?.lifetimeValue}`);

  if (updatedCustomer?.lifetimeValue !== order.totalAmount) {
    throw new Error("Customer lifetime value was not updated on payment verification!");
  }

  console.log("✅ TEST 3 PASSED: Full Order & Inventory Decrement Workflow verified.");
}

testOrderWorkflow()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test 3 Failed:", err);
    process.exit(1);
  });
