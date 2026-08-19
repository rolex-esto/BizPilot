import { prisma } from "../lib/prisma";
import { seedOnlineMsme } from "../lib/seed-online-msme";

async function main() {
  console.log("============================================================");
  console.log("SEEDING REALISTIC ONLINE MSME BUSINESS (TECHHAVEN PHILIPPINES)");
  console.log("============================================================");

  const business = await seedOnlineMsme();
  console.log(`✅ Successfully seeded business "${business.name}" (${business.id})`);
  console.log(`Owner: ${business.ownerName} (${business.email})`);
  console.log(`Fulfillment Model: Online Only (Meetup / LBC / Courier)`);

  const [products, customers, orders, calendarEvents] = await Promise.all([
    prisma.product.count({ where: { businessId: business.id } }),
    prisma.customer.count({ where: { businessId: business.id } }),
    prisma.order.count({ where: { businessId: business.id } }),
    prisma.calendarEvent.count({ where: { businessId: business.id } }),
  ]);

  console.log({
    productsSeeded: products,
    customersSeeded: customers,
    ordersSeeded: orders,
    calendarEventsSeeded: calendarEvents,
  });

  await prisma.$disconnect();
}

main().catch(console.error);
