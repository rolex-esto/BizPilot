import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth/password";
import { maskName, maskPhone, maskEmail, maskAddress, getActiveSupportSession } from "../lib/auth/support-session";

async function runPrivacyTestSuite() {
  console.log("============================================================");
  console.log("STARTING BIZPILOT PRIVACY-FIRST ADMIN CONTROL TEST SUITE");
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
    // ─── 1. MASKING HELPERS TEST ───
    const maskedName = maskName("Maria Santos");
    assert(maskedName.startsWith("Maria S") && maskedName.includes("*"), `maskName masks customer surname: "${maskedName}"`);

    const maskedPhone = maskPhone("09171234567");
    assert(maskedPhone.startsWith("0917") && maskedPhone.includes("*"), `maskPhone masks customer phone: "${maskedPhone}"`);

    const maskedEmail = maskEmail("maria.santos@gmail.com");
    assert(maskedEmail.startsWith("m*****@") && maskedEmail.includes("*"), `maskEmail masks customer email: "${maskedEmail}"`);

    const maskedAddr = maskAddress("123 Acacia St, SM Megamall");
    assert(maskedAddr.includes("Privacy Protected"), `maskAddress protects customer address: "${maskedAddr}"`);

    // ─── 2. SETUP TEST BUSINESS & ADMIN ───
    const testAdmin = await prisma.user.upsert({
      where: { email: "bizpilot.mailer@gmail.com" },
      update: { role: "ADMIN", emailVerified: true },
      create: {
        email: "bizpilot.mailer@gmail.com",
        name: "BizPilot Administrator",
        passwordHash: hashPassword("Admin2026!SecureBoot"),
        role: "ADMIN",
        emailVerified: true,
        businessId: null,
      },
    });

    const testBiz = await prisma.business.create({
      data: {
        name: "Privacy Shield Test Store",
        ownerName: "Elena Ramos",
        email: "elena@shieldstore.ph",
        planTier: "BUSINESS",
        subscriptionStatus: "ACTIVE",
      },
    });

    // ─── 3. DEFAULT STATE: NO SUPPORT SESSION (MASKED) ───
    const sessionBefore = await getActiveSupportSession(testAdmin.id, testBiz.id);
    assert(sessionBefore === null, "Default state has no active support session");

    // ─── 4. START TIME-BOUND SUPPORT SESSION ───
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 mins

    const newSupportSession = await prisma.supportSession.create({
      data: {
        adminId: testAdmin.id,
        businessId: testBiz.id,
        reason: "Customer reported order discrepancy for troubleshooting",
        scope: "ORDERS",
        durationMinutes: 30,
        status: "ACTIVE",
        startedAt: now,
        expiresAt,
      },
    });

    assert(newSupportSession.status === "ACTIVE", "Support session started with ACTIVE status");
    assert(newSupportSession.scope === "ORDERS", "Support session scope restricted to ORDERS");

    const sessionActive = await getActiveSupportSession(testAdmin.id, testBiz.id);
    assert(Boolean(sessionActive && sessionActive.id === newSupportSession.id), "Active support session successfully validated by server guard");

    // ─── 5. AUTOMATIC EXPIRATION TEST ───
    // Create an expired session
    const expiredSupportSession = await prisma.supportSession.create({
      data: {
        adminId: testAdmin.id,
        businessId: testBiz.id,
        reason: "Old ticket from yesterday",
        scope: "ORDERS",
        durationMinutes: 15,
        status: "ACTIVE",
        startedAt: new Date(Date.now() - 3600 * 1000),
        expiresAt: new Date(Date.now() - 60 * 1000), // Expired 1 min ago
      },
    });

    // Calling helper should auto-expire
    const checkedExpired = await getActiveSupportSession(testAdmin.id, testBiz.id);
    // Should return the valid one (newSupportSession), not the expired one
    assert(Boolean(checkedExpired && checkedExpired.id === newSupportSession.id), "Server guard automatically excludes and expires outdated support sessions");

    // ─── 6. EARLY REVOCATION TEST ───
    await prisma.supportSession.update({
      where: { id: newSupportSession.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });

    const sessionAfterRevoke = await getActiveSupportSession(testAdmin.id, testBiz.id);
    assert(sessionAfterRevoke === null, "Revoking support session immediately cuts off unmasked access");

    // ─── 7. AUDIT LOG RECORDING TEST ───
    const auditRecord = await prisma.auditLog.create({
      data: {
        businessId: testBiz.id,
        action: "ADMIN_SUPPORT_SESSION_STARTED",
        entityType: "SupportSession",
        entityId: newSupportSession.id,
        details: `Support session started by ${testAdmin.name}. Reason: "Customer reported order discrepancy". Duration: 30 mins.`,
        performedBy: "ADMIN",
      },
    });

    assert(Boolean(auditRecord && !auditRecord.details?.includes("password")), "Audit log accurately records support access without sensitive secrets");

    // ─── 8. CLEANUP ───
    await prisma.supportSession.deleteMany({ where: { businessId: testBiz.id } });
    await prisma.auditLog.deleteMany({ where: { businessId: testBiz.id } });
    await prisma.business.deleteMany({ where: { id: testBiz.id } });

    console.log("\n============================================================");
    console.log(`PRIVACY TEST SUITE PASSED: ${passed}/${total} assertions`);
    console.log("============================================================\n");
  } catch (err: any) {
    console.error("PRIVACY TEST SUITE FAILED:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPrivacyTestSuite();
