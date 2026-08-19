import { prisma } from "../lib/prisma";
import { bootstrapAdminAccount } from "../lib/auth/bootstrap";

async function main() {
  console.log("============================================================");
  console.log("PRE-DEPLOYMENT CLEANUP & SECURE ADMIN BOOTSTRAP");
  console.log("============================================================");

  // 1. Transactional Cleanup of all demo/test business data
  console.log("Step 1: Identifying and cleaning demo/test business records...");
  const cleanupStats = await prisma.$transaction(async (tx) => {
    const orderItems = await tx.orderItem.deleteMany();
    const payments = await tx.payment.deleteMany();
    const calendarEvents = await tx.calendarEvent.deleteMany();
    const orders = await tx.order.deleteMany();
    const messages = await tx.message.deleteMany();
    const leads = await tx.lead.deleteMany();
    const conversations = await tx.conversation.deleteMany();
    const identityLinks = await tx.customerIdentityLink.deleteMany();
    const customers = await tx.customer.deleteMany();
    const products = await tx.product.deleteMany();
    const platformConns = await tx.platformConnection.deleteMany();
    const calendarConns = await tx.calendarConnection.deleteMany();
    const aiInsights = await tx.aiInsight.deleteMany();
    const auditLogs = await tx.auditLog.deleteMany();
    const businesses = await tx.business.deleteMany();

    return {
      orderItems: orderItems.count,
      payments: payments.count,
      calendarEvents: calendarEvents.count,
      orders: orders.count,
      messages: messages.count,
      leads: leads.count,
      conversations: conversations.count,
      identityLinks: identityLinks.count,
      customers: customers.count,
      products: products.count,
      platformConns: platformConns.count,
      calendarConns: calendarConns.count,
      aiInsights: aiInsights.count,
      auditLogs: auditLogs.count,
      businesses: businesses.count,
    };
  });

  console.log("✅ Removed demo records cleanly:", JSON.stringify(cleanupStats, null, 2));

  // 2. Bootstrap Secure Admin Account
  console.log("\nStep 2: Bootstrapping secure administrator account...");
  const admin = await bootstrapAdminAccount();
  console.log(`✅ Admin Account: ${admin.email} (Role: ${admin.role}, ID: ${admin.userId})`);

  // 3. Verify clean deployment state
  console.log("\nStep 3: Verifying clean deployment state...");
  const [
    remainingBusinesses,
    remainingProducts,
    remainingCustomers,
    remainingOrders,
    remainingPayments,
    remainingEvents,
    totalUsers,
  ] = await Promise.all([
    prisma.business.count(),
    prisma.product.count(),
    prisma.customer.count(),
    prisma.order.count(),
    prisma.payment.count(),
    prisma.calendarEvent.count(),
    prisma.user.count(),
  ]);

  console.log({
    businessesInDb: remainingBusinesses,
    productsInDb: remainingProducts,
    customersInDb: remainingCustomers,
    ordersInDb: remainingOrders,
    paymentsInDb: remainingPayments,
    calendarEventsInDb: remainingEvents,
    adminUsersInDb: totalUsers,
  });

  if (
    remainingBusinesses === 0 &&
    remainingProducts === 0 &&
    remainingCustomers === 0 &&
    remainingOrders === 0 &&
    remainingPayments === 0 &&
    remainingEvents === 0 &&
    totalUsers >= 1
  ) {
    console.log("\n🎉 APPLICATION IS IN CLEAN DEPLOYMENT STATE (Ready for manual owner entry).");
  } else {
    console.warn("⚠️ Warning: Non-zero records remain in database.");
  }

  await prisma.$disconnect();
}

main().catch(console.error);
