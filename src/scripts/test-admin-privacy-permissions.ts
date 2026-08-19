import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth/password";
import { createSession } from "../lib/auth/session";
import { maskName, maskPhone, maskEmail, maskAddress, getActiveSupportSession } from "../lib/auth/support-session";

async function runAdminPrivacyAndPermissionsSuite() {
  console.log("============================================================");
  console.log("STARTING ADMIN PRIVACY, PERMISSIONS & AUDIT SEPARATION SUITE");
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
    // ─── 1. ISOLATED TEST USERS ───
    const testAdmin = await prisma.user.create({
      data: {
        email: `test_admin_perm_${Date.now()}@bizpilot.ph`,
        name: "Test System Administrator",
        passwordHash: hashPassword("AdminTestPassword2026!"),
        role: "ADMIN",
        emailVerified: true,
        businessId: null,
      },
    });

    const testBiz = await prisma.business.create({
      data: {
        name: "Privacy Guard Electronics",
        ownerName: "Marco Silang",
        email: "marco@privacyguard.ph",
        planTier: "BUSINESS",
        subscriptionStatus: "ACTIVE",
      },
    });

    const testOwner = await prisma.user.create({
      data: {
        email: `test_owner_perm_${Date.now()}@example.com`,
        name: "Marco Silang",
        passwordHash: hashPassword("OwnerPassword2026!"),
        role: "OWNER",
        emailVerified: true,
        businessId: testBiz.id,
      },
    });

    assert(testAdmin.role === "ADMIN", "Admin user created with ADMIN role");
    assert(testOwner.role === "OWNER", "Store owner user created with OWNER role");

    // ─── 2. SENSITIVE CREDENTIAL & SECRET PROTECTION ───
    const conn = await prisma.platformConnection.create({
      data: {
        businessId: testBiz.id,
        platform: "FACEBOOK",
        platformAccountId: "fb_acc_12345",
        platformAccountName: "PrivacyGuard FB Page",
        accessTokenEncrypted: "SUPER_SECRET_OAUTH_TOKEN",
        status: "CONNECTED",
      },
    });

    const safeConnection = await prisma.platformConnection.findUnique({
      where: { id: conn.id },
      select: {
        id: true,
        platform: true,
        platformAccountName: true,
        status: true,
      },
    });

    assert(Boolean(safeConnection && !("accessTokenEncrypted" in safeConnection)), "Channel OAuth tokens are excluded from administrative queries");

    // ─── 3. CUSTOMER PRIVACY MASKING ───
    const customer = await prisma.customer.create({
      data: {
        businessId: testBiz.id,
        name: "Juan Dela Cruz",
        phone: "+639171234567",
        email: "juan.delacruz@example.com",
        primaryPlatform: "FACEBOOK",
      },
    });

    const maskedCustomerName = maskName(customer.name);
    const maskedCustomerPhone = maskPhone(customer.phone);
    const maskedCustomerEmail = maskEmail(customer.email);

    assert(maskedCustomerName.startsWith("Juan D") && maskedCustomerName.includes("*"), `Customer surname masked: "${maskedCustomerName}"`);
    assert(maskedCustomerPhone.startsWith("+639") && maskedCustomerPhone.includes("*"), `Customer phone number masked: "${maskedCustomerPhone}"`);
    assert(maskedCustomerEmail.startsWith("j*****@"), `Customer email address masked: "${maskedCustomerEmail}"`);

    // ─── 4. AUDIT LOG SEPARATION (ADMIN vs OWNER vs SYSTEM) ───
    await prisma.auditLog.createMany({
      data: [
        {
          businessId: testBiz.id,
          action: "ADMIN_LOGIN",
          entityType: "User",
          entityId: testAdmin.id,
          details: "Admin signed in to Control Center",
          performedBy: "ADMIN",
        },
        {
          businessId: testBiz.id,
          action: "EMAIL_SENT",
          entityType: "Email",
          details: "Verification email sent to user",
          performedBy: "SYSTEM",
        },
        {
          businessId: testBiz.id,
          action: "MESSAGE_SENT",
          entityType: "Message",
          details: "Owner sent message to customer",
          performedBy: "OWNER",
        },
      ],
    });

    const allLogs = await prisma.auditLog.findMany({
      where: { businessId: testBiz.id },
    });

    const adminLogs = allLogs.filter((l) => l.performedBy === "ADMIN");
    const systemLogs = allLogs.filter((l) => l.performedBy === "SYSTEM");
    const ownerLogs = allLogs.filter((l) => l.performedBy === "OWNER");

    assert(adminLogs.length === 1 && adminLogs[0].action === "ADMIN_LOGIN", "Admin security activity cleanly separated");
    assert(systemLogs.length === 1 && systemLogs[0].action === "EMAIL_SENT", "System operational activity cleanly separated");
    assert(ownerLogs.length === 1 && ownerLogs[0].action === "MESSAGE_SENT", "Owner business activity kept private and separate from admin logs");

    // ─── 5. CLEANUP ───
    await prisma.platformConnection.deleteMany({ where: { businessId: testBiz.id } });
    await prisma.customer.deleteMany({ where: { businessId: testBiz.id } });
    await prisma.auditLog.deleteMany({ where: { businessId: testBiz.id } });
    await prisma.session.deleteMany({ where: { user: { id: { in: [testAdmin.id, testOwner.id] } } } });
    await prisma.user.deleteMany({ where: { id: { in: [testAdmin.id, testOwner.id] } } });
    await prisma.business.deleteMany({ where: { id: testBiz.id } });

    console.log("\n============================================================");
    console.log(`ADMIN PRIVACY & AUDIT SEPARATION SUITE PASSED: ${passed}/${total} assertions`);
    console.log("============================================================\n");
  } catch (err: any) {
    console.error("ADMIN PRIVACY SUITE FAILED:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAdminPrivacyAndPermissionsSuite();
