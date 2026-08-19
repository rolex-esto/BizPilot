import { prisma } from "../lib/prisma";

async function main() {
  console.log("--- MIGRATING LEGACY SIMULATOR / PRACTICE RECORDS ---");

  // 1. Classify Customers with sim_ prefix or source SIMULATOR
  const updatedCustomers = await prisma.customer.updateMany({
    where: {
      OR: [
        { externalId: { startsWith: "sim_" } },
        { source: "SIMULATOR" },
        { name: { contains: "Simulated" } },
        { name: { contains: "Tawad" } },
      ],
    },
    data: {
      environment: "PRACTICE",
    },
  });
  console.log(`Updated ${updatedCustomers.count} legacy practice customers to environment=PRACTICE.`);

  // 2. Classify Conversations with practice customers or manual platform
  const practiceCustomers = await prisma.customer.findMany({
    where: { environment: "PRACTICE" },
    select: { id: true },
  });
  const practiceCustIds = practiceCustomers.map((c) => c.id);

  const updatedConvs = await prisma.conversation.updateMany({
    where: {
      OR: [
        { customerId: { in: practiceCustIds } },
        { platform: "MANUAL" },
      ],
    },
    data: {
      environment: "PRACTICE",
      sourceType: "SIMULATOR",
    },
  });
  console.log(`Updated ${updatedConvs.count} legacy practice conversations to environment=PRACTICE, sourceType=SIMULATOR.`);

  // 3. Classify Messages in practice conversations
  const practiceConvs = await prisma.conversation.findMany({
    where: { environment: "PRACTICE" },
    select: { id: true },
  });
  const practiceConvIds = practiceConvs.map((c) => c.id);

  const updatedMessages = await prisma.message.updateMany({
    where: {
      conversationId: { in: practiceConvIds },
    },
    data: {
      environment: "PRACTICE",
      sourceType: "SIMULATOR",
    },
  });
  console.log(`Updated ${updatedMessages.count} legacy practice messages to environment=PRACTICE, sourceType=SIMULATOR.`);

  // 4. Classify Leads and Orders
  const updatedLeads = await prisma.lead.updateMany({
    where: {
      OR: [
        { customerId: { in: practiceCustIds } },
        { conversationId: { in: practiceConvIds } },
      ],
    },
    data: {
      environment: "PRACTICE",
    },
  });
  console.log(`Updated ${updatedLeads.count} legacy practice leads to environment=PRACTICE.`);

  const updatedOrders = await prisma.order.updateMany({
    where: {
      OR: [
        { customerId: { in: practiceCustIds } },
        { conversationId: { in: practiceConvIds } },
      ],
    },
    data: {
      environment: "PRACTICE",
    },
  });
  console.log(`Updated ${updatedOrders.count} legacy practice orders to environment=PRACTICE.`);

  console.log("--- MIGRATION COMPLETE ---");
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
