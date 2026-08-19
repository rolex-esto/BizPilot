import { prisma } from "../lib/prisma";
import { cleanupBusinessTestData } from "../lib/cleanup";

async function main() {
  console.log("============================================================");
  console.log("EXECUTING SAFE TRANSACTIONAL TEST DATA CLEANUP");
  console.log("============================================================");

  try {
    const result = await cleanupBusinessTestData();
    console.log(`✅ Successfully cleaned up business "${result.businessName}" (${result.businessId})`);
    console.log("Deleted Records Summary:", JSON.stringify(result.deletedCounts, null, 2));
  } catch (err: any) {
    console.warn("Cleanup Notice:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
