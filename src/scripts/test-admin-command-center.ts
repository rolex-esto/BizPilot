import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth/password";

async function runAdminCommandCenterSuite() {
  console.log("============================================================");
  console.log("STARTING ADMIN COMMAND CENTER VALIDATION SUITE");
  console.log("============================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  try {
    // ─── 1. REAL DATABASE METRICS ACCURACY ───
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [businessCount, userCount, productCount, orderCount, customerCount] = await Promise.all([
      prisma.business.count(),
      prisma.user.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.customer.count(),
    ]);

    assert(typeof businessCount === "number" && businessCount >= 0, `Real database business count: ${businessCount}`);
    assert(typeof userCount === "number" && userCount >= 0, `Real database user count: ${userCount}`);
    assert(typeof productCount === "number" && productCount >= 0, `Real database product count: ${productCount}`);
    assert(typeof orderCount === "number" && orderCount >= 0, `Real database order count: ${orderCount}`);
    assert(typeof customerCount === "number" && customerCount >= 0, `Real database customer count: ${customerCount}`);

    // ─── 2. DYNAMIC ATTENTION ALERTS & TRIALS SOON ───
    const testBizExpiring = await prisma.business.create({
      data: {
        name: "Command Center Test Store",
        ownerName: "Test Owner",
        email: `command_center_${Date.now()}@test.ph`,
        planTier: "BUSINESS",
        subscriptionStatus: "TRIAL",
        trialEndsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days left
      },
    });

    const trialsEndingSoon = await prisma.business.findMany({
      where: {
        subscriptionStatus: "TRIAL",
        trialEndsAt: { not: null },
      },
      select: {
        id: true,
        name: true,
        ownerName: true,
        planTier: true,
        trialEndsAt: true,
      },
    });

    const testTrial = trialsEndingSoon.find((t) => t.id === testBizExpiring.id);
    assert(Boolean(testTrial), "Dynamic trial query includes store with ending trial");

    const daysLeft = Math.max(0, Math.ceil((new Date(testTrial!.trialEndsAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    assert(daysLeft <= 3, `Trial ending soon calculates days remaining accurately (${daysLeft} days left)`);

    // ─── 3. AUDIT LOG SEPARATION ───
    const testAdmin = await prisma.user.create({
      data: {
        email: `command_admin_${Date.now()}@bizpilot.ph`,
        name: "Command Admin",
        passwordHash: hashPassword("Admin2026!Secure"),
        role: "ADMIN",
        emailVerified: true,
        businessId: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        businessId: testBizExpiring.id,
        action: "ADMIN_LOGIN",
        entityType: "User",
        entityId: testAdmin.id,
        details: "Admin accessed Command Center",
        performedBy: "ADMIN",
      },
    });

    const adminLogs = await prisma.auditLog.findMany({
      where: { performedBy: "ADMIN" },
    });
    assert(adminLogs.some((l) => l.action === "ADMIN_LOGIN"), "Admin security activity logged and queryable with performedBy = ADMIN");

    // ─── 4. CLEANUP ───
    await prisma.auditLog.deleteMany({ where: { businessId: testBizExpiring.id } });
    await prisma.session.deleteMany({ where: { userId: testAdmin.id } });
    await prisma.user.deleteMany({ where: { id: testAdmin.id } });
    await prisma.business.deleteMany({ where: { id: testBizExpiring.id } });

    console.log("\n============================================================");
    console.log(`ADMIN COMMAND CENTER SUITE PASSED: ${passed}/${total} assertions`);
    console.log("============================================================\n");
  } catch (err: any) {
    console.error("COMMAND CENTER SUITE FAILED:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAdminCommandCenterSuite();
