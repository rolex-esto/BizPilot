import { prisma } from "./prisma";

export interface CleanupResult {
  businessId: string;
  businessName: string;
  ownerName: string;
  deletedCounts: {
    orderItems: number;
    payments: number;
    orders: number;
    calendarEvents: number;
    messages: number;
    conversations: number;
    leads: number;
    customerIdentityLinks: number;
    customers: number;
    products: number;
    platformConnections: number;
    calendarConnections: number;
    aiInsights: number;
    auditLogs: number;
    business: number;
  };
  success: boolean;
  timestamp: Date;
}

/**
 * Safely removes a business and all its dependent test data in a single ACID transaction.
 * Foreign-key aware, preventing orphaned rows.
 */
export async function cleanupBusinessTestData(targetBusinessId?: string): Promise<CleanupResult> {
  const business = targetBusinessId
    ? await prisma.business.findUnique({ where: { id: targetBusinessId } })
    : await prisma.business.findFirst({
        where: {
          OR: [
            { ownerName: "Christian Reyes" },
            { name: "BizPilot" },
            { email: "owner@bizpilot.ph" },
          ],
        },
      });

  if (!business) {
    throw new Error(`Target business not found for cleanup.`);
  }

  const bId = business.id;

  return await prisma.$transaction(async (tx) => {
    // 1. Delete Order Items (linked through orders of this business)
    const orderItems = await tx.orderItem.deleteMany({
      where: { order: { businessId: bId } },
    });

    // 2. Delete Payments
    const payments = await tx.payment.deleteMany({
      where: { businessId: bId },
    });

    // 3. Delete Calendar Events
    const calendarEvents = await tx.calendarEvent.deleteMany({
      where: { businessId: bId },
    });

    // 4. Delete Orders
    const orders = await tx.order.deleteMany({
      where: { businessId: bId },
    });

    // 5. Delete Messages
    const messages = await tx.message.deleteMany({
      where: { conversation: { businessId: bId } },
    });

    // 6. Delete Leads
    const leads = await tx.lead.deleteMany({
      where: { businessId: bId },
    });

    // 7. Delete Conversations
    const conversations = await tx.conversation.deleteMany({
      where: { businessId: bId },
    });

    // 8. Delete Customer Identity Links
    const customerIdentityLinks = await tx.customerIdentityLink.deleteMany({
      where: { customer: { businessId: bId } },
    });

    // 9. Delete Customers
    const customers = await tx.customer.deleteMany({
      where: { businessId: bId },
    });

    // 10. Delete Products
    const products = await tx.product.deleteMany({
      where: { businessId: bId },
    });

    // 11. Delete Platform Connections
    const platformConnections = await tx.platformConnection.deleteMany({
      where: { businessId: bId },
    });

    // 12. Delete Calendar Connections
    const calendarConnections = await tx.calendarConnection.deleteMany({
      where: { businessId: bId },
    });

    // 13. Delete AI Insights
    const aiInsights = await tx.aiInsight.deleteMany({
      where: { businessId: bId },
    });

    // 14. Delete Audit Logs
    const auditLogs = await tx.auditLog.deleteMany({
      where: { businessId: bId },
    });

    // 15. Delete Business Profile
    const bizDel = await tx.business.delete({
      where: { id: bId },
    });

    return {
      businessId: bId,
      businessName: business.name,
      ownerName: business.ownerName,
      deletedCounts: {
        orderItems: orderItems.count,
        payments: payments.count,
        orders: orders.count,
        calendarEvents: calendarEvents.count,
        messages: messages.count,
        conversations: conversations.count,
        leads: leads.count,
        customerIdentityLinks: customerIdentityLinks.count,
        customers: customers.count,
        products: products.count,
        platformConnections: platformConnections.count,
        calendarConnections: calendarConnections.count,
        aiInsights: aiInsights.count,
        auditLogs: auditLogs.count,
        business: bizDel ? 1 : 0,
      },
      success: true,
      timestamp: new Date(),
    };
  });
}
