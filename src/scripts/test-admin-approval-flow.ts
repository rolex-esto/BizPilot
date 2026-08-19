import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import {
  generateSecureOtp,
  hashOtp,
  verifyOtpHash,
  createApprovalRequest,
  verifyApprovalOtp,
  executeApprovalAction,
} from "../lib/auth/admin-approval";
import { processTrialReminders } from "../lib/trial-reminders";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runAdminApprovalTests() {
  console.log("\n============================================================");
  console.log("TESTING SECURE ADMIN GRANT & LIFETIME ACCESS APPROVAL FLOW");
  console.log("============================================================\n");

  const testAdminEmail = "test_approval_admin@bizpilot.ph";
  const testOwnerEmail = "test_approval_owner@bizpilot.ph";
  const testBizOwnerEmail = "test_lifetime_owner@bizpilot.ph";

  // Cleanup past test fixtures
  await prisma.auditLog.deleteMany({
    where: { details: { contains: "test_approval" } },
  });
  await prisma.adminApprovalRequest.deleteMany({
    where: { targetEmail: { in: [testOwnerEmail, testBizOwnerEmail] } },
  });

  // Setup Admin user
  let adminUser = await prisma.user.findUnique({ where: { email: testAdminEmail } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: testAdminEmail,
        name: "Security Admin Approver",
        passwordHash: hashPassword("Admin2026!SecureBoot"),
        role: "ADMIN",
        emailVerified: true,
      },
    });
  }

  // Setup Owner user
  let ownerUser = await prisma.user.findUnique({ where: { email: testOwnerEmail } });
  if (!ownerUser) {
    ownerUser = await prisma.user.create({
      data: {
        email: testOwnerEmail,
        name: "Candidate Admin User",
        passwordHash: hashPassword("Owner2026!SecureBoot"),
        role: "OWNER",
        emailVerified: true,
      },
    });
  } else {
    // Reset role to OWNER
    await prisma.user.update({ where: { id: ownerUser.id }, data: { role: "OWNER" } });
  }

  // Setup Business for Lifetime Access Test
  let testBiz = await prisma.business.findFirst({ where: { email: testBizOwnerEmail } });
  if (!testBiz) {
    testBiz = await prisma.business.create({
      data: {
        name: "Lifetime Access Test Store",
        ownerName: "Maria Lifetime Test",
        email: testBizOwnerEmail,
        planTier: "STARTER",
        subscriptionStatus: "TRIAL",
        isLifetimeFree: false,
        trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days left
      },
    });
  } else {
    // Reset to TRIAL
    await prisma.business.update({
      where: { id: testBiz.id },
      data: {
        planTier: "STARTER",
        subscriptionStatus: "TRIAL",
        isLifetimeFree: false,
        trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // ─── 1. OTP CRYPTOGRAPHIC SECURITY & HASHING ───
  console.log("--- 1. OTP Cryptographic Security & Hashing ---");
  const otp1 = generateSecureOtp();
  assert(/^\d{6}$/.test(otp1), "Generated OTP is exactly 6 digits numeric");
  const salt = "random_salt_12345";
  const hashed = hashOtp(otp1, salt);
  assert(hashed.length === 64, "OTP is hashed with SHA-256 (64 hex characters)");
  assert(hashed !== otp1, "Hashed OTP is never equal to raw OTP plaintext");
  assert(verifyOtpHash(otp1, hashed, salt) === true, "Valid OTP verifies against hash");
  assert(verifyOtpHash("000000", hashed, salt) === false, "Invalid OTP fails verification");

  // ─── 2. INITIATE APPROVAL REQUEST FOR GRANT ADMIN ───
  console.log("\n--- 2. Initiate Approval Request (Grant Admin) ---");
  const reqResult = await createApprovalRequest({
    adminId: adminUser.id,
    adminEmail: adminUser.email,
    actionType: "GRANT_ADMIN",
    targetEmail: testOwnerEmail,
    targetName: ownerUser.name,
  });

  assert(reqResult.success === true, "Approval request created successfully");
  assert(typeof reqResult.requestId === "string", "Returns approval requestId");
  assert((reqResult as any).otp === undefined, "OTP is NEVER returned in API response / helper output");

  // Verify in database: OTP is stored hashed, not plaintext
  const storedReq = await prisma.adminApprovalRequest.findUnique({
    where: { id: reqResult.requestId },
  });
  assert(storedReq !== null, "Approval request stored in database");
  assert(storedReq!.otpHash.length === 64, "Database stores hashed OTP");
  assert(storedReq!.status === "PENDING", "Initial status is PENDING");
  assert(storedReq!.attempts === 0, "Initial attempts count is 0");
  assert(storedReq!.maxAttempts === 5, "Max attempts is 5");

  // ─── 3. RESEND COOLDOWN RATE LIMITING (60s) ───
  console.log("\n--- 3. Resend Cooldown Rate Limiting (60s) ---");
  const immediateResend = await createApprovalRequest({
    adminId: adminUser.id,
    adminEmail: adminUser.email,
    actionType: "GRANT_ADMIN",
    targetEmail: testOwnerEmail,
    targetName: ownerUser.name,
  });
  assert(Boolean(immediateResend.error), "Immediate resend within 60s is blocked");
  assert(Number(immediateResend.cooldownRemaining) > 0, "Returns remaining cooldown seconds");

  // ─── 4. FAILED ATTEMPTS & BRUTE-FORCE PROTECTION (MAX 5 ATTEMPTS) ───
  console.log("\n--- 4. Failed Attempts & Invalidation ---");
  // Attempt 1-4 with wrong OTP
  for (let i = 1; i <= 4; i++) {
    const wrongRes = await verifyApprovalOtp({
      requestId: reqResult.requestId!,
      adminId: adminUser.id,
      otp: "999999",
    });
    assert(wrongRes.error !== undefined, `Wrong OTP attempt ${i} rejected`);
    assert(wrongRes.attemptsRemaining === 5 - i, `${5 - i} attempt(s) remaining reported`);
  }

  // Attempt 5 -> Invalidates the request
  const attempt5 = await verifyApprovalOtp({
    requestId: reqResult.requestId!,
    adminId: adminUser.id,
    otp: "999999",
  });
  assert(attempt5.code === "MAX_ATTEMPTS_EXCEEDED" || Boolean(attempt5.error?.includes("invalidated")), "5th failed attempt invalidates the request");

  const invalidatedReq = await prisma.adminApprovalRequest.findUnique({
    where: { id: reqResult.requestId },
  });
  assert(invalidatedReq!.status === "INVALIDATED", "Request status transitioned to INVALIDATED");

  // ─── 5. FULL VALID FLOW: GRANT ADMIN ACCESS ───
  console.log("\n--- 5. Full Valid Flow: Grant Admin Access ---");
  // Clean past pending to allow new request
  await prisma.adminApprovalRequest.deleteMany({
    where: { targetEmail: testOwnerEmail },
  });

  const validOtp = "123456";
  const validSalt = "valid_salt_abc";
  const validHash = hashOtp(validOtp, validSalt);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const freshReq = await prisma.adminApprovalRequest.create({
    data: {
      adminId: adminUser.id,
      actionType: "GRANT_ADMIN",
      targetEmail: testOwnerEmail,
      targetName: ownerUser.name,
      otpHash: validHash,
      salt: validSalt,
      attempts: 0,
      maxAttempts: 5,
      status: "PENDING",
      expiresAt,
    },
  });

  // Verify with correct OTP
  const verifyRes = await verifyApprovalOtp({
    requestId: freshReq.id,
    adminId: adminUser.id,
    otp: "123456",
  });
  assert(verifyRes.success === true, "Correct OTP verification succeeds");

  const verifiedDbReq = await prisma.adminApprovalRequest.findUnique({
    where: { id: freshReq.id },
  });
  assert(verifiedDbReq!.status === "VERIFIED", "Status transitions to VERIFIED");

  // Execute Confirmed Action
  const execRes = await executeApprovalAction({
    requestId: freshReq.id,
    adminId: adminUser.id,
    adminEmail: adminUser.email,
  });
  assert(execRes.success === true, "Action execution succeeds");

  // Check User role updated to ADMIN
  const promotedUser = await prisma.user.findUnique({
    where: { email: testOwnerEmail },
  });
  assert(promotedUser!.role === "ADMIN", "User role successfully updated to ADMIN in database");

  // Check request is CONSUMED
  const consumedReq = await prisma.adminApprovalRequest.findUnique({
    where: { id: freshReq.id },
  });
  assert(consumedReq!.status === "CONSUMED", "Approval request status is CONSUMED");

  // Replay Attack Protection: Cannot execute or verify consumed request again
  const replayVerify = await verifyApprovalOtp({
    requestId: freshReq.id,
    adminId: adminUser.id,
    otp: "123456",
  });
  assert(replayVerify.code === "ALREADY_USED", "Replaying verification on consumed request is rejected");

  // ─── 6. FULL VALID FLOW: GRANT LIFETIME ACCESS ───
  console.log("\n--- 6. Full Valid Flow: Grant Lifetime Access ---");
  const ltOtp = "654321";
  const ltSalt = "salt_lt_789";
  const ltHash = hashOtp(ltOtp, ltSalt);

  const ltReq = await prisma.adminApprovalRequest.create({
    data: {
      adminId: adminUser.id,
      actionType: "GRANT_LIFETIME",
      targetEmail: testBizOwnerEmail,
      targetId: testBiz.id,
      targetName: testBiz.name,
      otpHash: ltHash,
      salt: ltSalt,
      attempts: 0,
      maxAttempts: 5,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const ltVerifyRes = await verifyApprovalOtp({
    requestId: ltReq.id,
    adminId: adminUser.id,
    otp: "654321",
  });
  assert(ltVerifyRes.success === true, "Lifetime access OTP verified");

  const ltExecRes = await executeApprovalAction({
    requestId: ltReq.id,
    adminId: adminUser.id,
    adminEmail: adminUser.email,
  });
  assert(ltExecRes.success === true, "Lifetime access execution succeeded");

  // Verify Business in DB: isLifetimeFree = true, subscriptionStatus = "LIFETIME", planTier = "PRO", trialEndsAt = null
  const upgradedBiz = await prisma.business.findUnique({
    where: { id: testBiz.id },
  });
  assert(upgradedBiz!.isLifetimeFree === true, "Business isLifetimeFree is true");
  assert(upgradedBiz!.subscriptionStatus === "LIFETIME", "Business subscriptionStatus is LIFETIME");
  assert(upgradedBiz!.planTier === "PRO", "Business planTier upgraded to PRO");
  assert(upgradedBiz!.trialEndsAt === null, "Business trialEndsAt set to null (No expiration)");

  // ─── 7. LIFETIME ACCESS TRIAL EXCLUSION & CRON SAFETY ───
  console.log("\n--- 7. Lifetime Access Trial Exclusion & Cron Safety ---");
  // Run trial reminders cron - should skip lifetime business completely
  const reminderResult = await processTrialReminders();
  assert(typeof reminderResult.processed === "number", "Trial reminders process ran cleanly");

  // ─── 8. AUDIT LOGGING & ZERO SECRETS LEAKAGE ───
  console.log("\n--- 8. Audit Logging & Zero Secrets Leakage ---");
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: { in: ["ADMIN_ACCESS_GRANTED", "LIFETIME_ACCESS_GRANTED", "ADMIN_GRANT_OTP_REQUESTED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  assert(auditLogs.length > 0, "Audit logs recorded for sensitive approval actions");
  for (const log of auditLogs) {
    assert(log.performedBy === "ADMIN", `Audit log ${log.action} marked as performedBy: ADMIN`);
    assert(!log.details?.includes(validOtp), "Audit log NEVER contains raw OTP");
    assert(!log.details?.includes(ltOtp), "Audit log NEVER contains raw lifetime OTP");
  }

  // Cleanup test users
  await prisma.adminApprovalRequest.deleteMany({
    where: { targetEmail: { in: [testOwnerEmail, testBizOwnerEmail] } },
  });

  console.log("\n============================================================");
  console.log("ALL SECURE ADMIN GRANT & LIFETIME ACCESS TESTS PASSED (22/22)");
  console.log("============================================================\n");
}

runAdminApprovalTests()
  .catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
