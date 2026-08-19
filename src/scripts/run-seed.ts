import { seedDatabase } from "../lib/seed";

async function main() {
  console.log("Seeding database with BizPilot data...");
  const business = await seedDatabase();
  console.log("Database seeded successfully for business:", business.name);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
