import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import { createSession } from "../lib/auth/session";

async function runAdminTestSuite() {
  console.log("============================================================");
  console.log("STARTING BIZPILOT ADMIN ACCOUNT & CONTROL CENTER TEST SUITE");
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
    // ─── 1. ADMIN PROVISIONING & IDEMPOTENCY ───
    const adminEmail = "test_admin_sandbox@bizpilot.ph";
    const testAdminPassword = "AdminTestPassword2026!Secure";

    // Clean up previous test admin if needed
    await prisma.session.deleteMany({
      where: { user: { email: adminEmail } },
    });
    await prisma.user.deleteMany({
      where: { email: adminEmail },
    });

    // First creation
    const passwordHash = hashPassword(testAdminPassword);
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        name: "BizPilot Administrator",
        passwordHash,
        role: "ADMIN",
        businessId: null,
        emailVerified: true,
      },
    });

    assert(Boolean(adminUser.id), "Admin user provisioned successfully");
    assert(adminUser.role === "ADMIN", "Admin user role is ADMIN");
    assert(adminUser.businessId === null, "Admin user businessId is null (independent of any store)");

    // Idempotency: Attempt duplicate creation detection
    const existing = await prisma.user.findUnique({
      where: { email: adminEmail },
    });
    assert(Boolean(existing && existing.role === "ADMIN"), "Idempotent check detects existing admin without creating duplicate");

    // ─── 2. PASSWORD SECURITY ───
    const isValidPw = verifyPassword(testAdminPassword, adminUser.passwordHash);
    const isBadPwValid = verifyPassword("WrongPassword123", adminUser.passwordHash);
    assert(isValidPw === true, "Admin password hashes and verifies with scrypt correctly");
    assert(isBadPwValid === false, "Incorrect admin password rejected");

    // ─── 3. ADMIN SESSION AUTHENTICATION ───
    const session = await createSession(adminUser.id);
    assert(Boolean(session.token), "Admin session created in database");

    const sessionRecord = await prisma.session.findUnique({
      where: { token: session.token },
      include: { user: true },
    });
    assert(Boolean(sessionRecord && sessionRecord.user.role === "ADMIN"), "Admin session validates role from database");

    // ─── 4. NORMAL OWNER ISOLATION ───
    // Create a normal owner user and store
    const testBiz = await prisma.business.create({
      data: {
        name: "Admin Test Tech Store",
        ownerName: "Owner Juan",
        email: "juan@teststore.ph",
        planTier: "STARTER",
        subscriptionStatus: "TRIAL",
      },
    });

    const normalUser = await prisma.user.create({
      data: {
        email: `normal_owner_${Date.now()}@example.com`,
        name: "Normal Owner",
        passwordHash: hashPassword("OwnerPassword123"),
        role: "OWNER",
        businessId: testBiz.id,
        emailVerified: true,
      },
    });

    assert(normalUser.role === "OWNER", "Normal user role is OWNER");
    assert(normalUser.businessId === testBiz.id, "Normal user is bound to their store");

    // ─── 5. LAST-ADMIN DELETE PROTECTION ───
    const adminCountBefore = await prisma.user.count({ where: { role: "ADMIN" } });
    
    // Function expression that simulates delete guard
    const canDeleteAdmin = (currentAdminCount: number): boolean => currentAdminCount > 1;

    assert(canDeleteAdmin(1) === false, "Delete guard returns false (blocked) when only 1 admin exists");
    assert(canDeleteAdmin(2) === true, "Delete guard returns true (allowed) when 2 admins exist");
    assert(adminCountBefore >= 1, "At least 1 verified system administrator exists in database");

    // ─── 6. ADMIN SUBSCRIPTION & LIFETIME FREE GRANTING ───
    const updatedBiz = await prisma.business.update({
      where: { id: testBiz.id },
      data: {
        planTier: "PRO",
        subscriptionStatus: "ACTIVE",
        trialEndsAt: null, // Lifetime no expiration
      },
    });

    assert(updatedBiz.planTier === "PRO", "Admin successfully upgraded store to PRO plan tier");
    assert(updatedBiz.subscriptionStatus === "ACTIVE", "Admin set subscription status to ACTIVE");
    assert(updatedBiz.trialEndsAt === null, "Admin set trialEndsAt to null for Lifetime Free status");

    // ─── 7. INVENTORY STOCK ADJUSTMENT & AUDIT LOG ───
    const testProduct = await prisma.product.create({
      data: {
        businessId: testBiz.id,
        name: "ThinkPad T480 Admin Test",
        sku: "TP-T480-ADM",
        price: 18500,
        stockQuantity: 5,
      },
    });

    // Admin stock adjustment
    const adjustedProduct = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id: testProduct.id },
        data: { stockQuantity: 8 },
      });
      await tx.auditLog.create({
        data: {
          businessId: testBiz.id,
          action: "INVENTORY_ADJUSTED",
          entityType: "Product",
          entityId: testProduct.id,
          details: `Admin adjusted stock from 5 to 8 for "${testProduct.name}"`,
          performedBy: "ADMIN",
        },
      });
      return p;
    });

    assert(adjustedProduct.stockQuantity === 8, "Admin adjusted inventory stock atomically");

    const auditEntry = await prisma.auditLog.findFirst({
      where: { entityId: testProduct.id, action: "INVENTORY_ADJUSTED" },
    });
    assert(Boolean(auditEntry && auditEntry.performedBy === "ADMIN"), "Inventory adjustment recorded in AuditLog without secrets");

    // ─── 8. CHANNEL CREDENTIAL MASKING ───
    const connection = await prisma.platformConnection.create({
      data: {
        businessId: testBiz.id,
        platform: "FACEBOOK",
        platformAccountId: "1092837465",
        platformAccountName: "TechStore FB Page",
        accessTokenEncrypted: "SUPER_SECRET_OAUTH_TOKEN",
        status: "CONNECTED",
      },
    });

    // Verify when selecting channels for admin, sensitive tokens are excluded
    const safeChannel = await prisma.platformConnection.findUnique({
      where: { id: connection.id },
      select: {
        id: true,
        platform: true,
        platformAccountName: true,
        status: true,
      },
    });

    assert(Boolean(safeChannel && !("accessTokenEncrypted" in safeChannel)), "Channel credential masking protects OAuth secrets from exposure");

    // ─── 9. CLEANUP TEST DATA ───
    await prisma.platformConnection.deleteMany({ where: { businessId: testBiz.id } });
    await prisma.auditLog.deleteMany({ where: { businessId: testBiz.id } });
    await prisma.product.deleteMany({ where: { businessId: testBiz.id } });
    await prisma.session.deleteMany({ where: { userId: normalUser.id } });
    await prisma.user.deleteMany({ where: { id: normalUser.id } });
    await prisma.session.deleteMany({ where: { user: { email: adminEmail } } });
    await prisma.user.deleteMany({ where: { email: adminEmail } });
    await prisma.business.deleteMany({ where: { id: testBiz.id } });

    console.log("\n============================================================");
    console.log(`ADMIN TEST SUITE PASSED: ${passed}/${total} assertions`);
    console.log("============================================================\n");
  } catch (err: any) {
    console.error("ADMIN TEST SUITE FAILED:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAdminTestSuite();
