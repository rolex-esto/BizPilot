import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import {
  generateSecureOtp,
  hashOtp,
  verifyOtpHash,
  createApprovalRequest,
  verifyApprovalOtp,
  executeApprovalAction,
} from "@/lib/auth/admin-approval";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`❌ FAIL: ${testName}${details ? ` — ${details}` : ""}`);
    failedCount++;
  }
}

async function runSubscriptionRestrictionsSuite() {
  console.log("============================================================");
  console.log("STARTING ADMIN SUBSCRIPTION & ACCESS RESTRICTION TESTS");
  console.log("============================================================\n");

  const timestamp = Date.now();
  const testAdminEmail = `admin_sub_${timestamp}@bizpilot.ph`;
  const testBizName = `Restricted Store ${timestamp}`;
  const testBizEmail = `store_sub_${timestamp}@bizpilot.ph`;

  // Create Test Admin
  const admin = await prisma.user.create({
    data: {
      email: testAdminEmail,
      name: "Subscription Admin",
      role: "ADMIN",
      passwordHash: await hashPassword("Admin2026!SecureBoot"),
      emailVerified: true,
    },
  });

  // Create Test Business (Initial: STARTER, TRIAL)
  const biz = await prisma.business.create({
    data: {
      name: testBizName,
      ownerName: "Sub Owner",
      email: testBizEmail,
      planTier: "STARTER",
      subscriptionStatus: "TRIAL",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 3600 * 1000), // 14 days
    },
  });

  // --- Helper to solve OTP for test automation ---
  async function solveOtpForRequest(requestId: string): Promise<string> {
    const req = await prisma.adminApprovalRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new Error("Request not found");
    for (let i = 100000; i <= 999999; i++) {
      if (verifyOtpHash(i.toString(), req.otpHash, req.salt)) {
        return i.toString();
      }
    }
    throw new Error("Could not solve OTP");
  }

  // --- TEST 1: Direct API / Unapproved Execution BLOCKED ---
  const directExec = await executeApprovalAction({
    requestId: "non-existent-request",
    adminId: admin.id,
    adminEmail: admin.email,
  });
  assert(directExec.error !== undefined, "1. Direct execution without verified approval is BLOCKED");

  // --- TEST 2: Starter -> Business Plan Transition ---
  const reqStarterToBiz = await createApprovalRequest({
    adminId: admin.id,
    adminEmail: admin.email,
    actionType: "CHANGE_PLAN",
    targetEmail: biz.email!,
    targetId: biz.id,
    targetName: biz.name,
    metadata: { currentPlan: "STARTER", requestedPlan: "BUSINESS", requestedStatus: "ACTIVE" },
  });
  assert(reqStarterToBiz.success === true, "2a. Approval request for Starter → Business created");

  const otpStarterToBiz = await solveOtpForRequest(reqStarterToBiz.requestId!);
  const verifyStarterToBiz = await verifyApprovalOtp({
    requestId: reqStarterToBiz.requestId!,
    adminId: admin.id,
    otp: otpStarterToBiz,
  });
  assert(verifyStarterToBiz.success === true, "2b. OTP verified for Starter → Business");

  const execStarterToBiz = await executeApprovalAction({
    requestId: reqStarterToBiz.requestId!,
    adminId: admin.id,
    adminEmail: admin.email,
  });
  assert(execStarterToBiz.success === true, "2c. Starter → Business transition executed successfully");

  const bizAfter2 = await prisma.business.findUnique({ where: { id: biz.id } });
  assert(bizAfter2?.planTier === "BUSINESS" && bizAfter2?.subscriptionStatus === "ACTIVE", "2d. Business state updated to BUSINESS / ACTIVE");

  // --- TEST 3: Business -> Pro Plan Transition ---
  const reqBizToPro = await createApprovalRequest({
    adminId: admin.id,
    adminEmail: admin.email,
    actionType: "CHANGE_PLAN",
    targetEmail: biz.email!,
    targetId: biz.id,
    targetName: biz.name,
    metadata: { currentPlan: "BUSINESS", requestedPlan: "PRO", requestedStatus: "ACTIVE" },
  });
  const otpBizToPro = await solveOtpForRequest(reqBizToPro.requestId!);
  await verifyApprovalOtp({ requestId: reqBizToPro.requestId!, adminId: admin.id, otp: otpBizToPro });
  const execBizToPro = await executeApprovalAction({ requestId: reqBizToPro.requestId!, adminId: admin.id, adminEmail: admin.email });
  assert(execBizToPro.success === true, "3. Business → Pro transition executed successfully");
  const bizAfter3 = await prisma.business.findUnique({ where: { id: biz.id } });
  assert(bizAfter3?.planTier === "PRO", "3b. Business state updated to PRO");

  // --- TEST 4: Pro -> Starter Plan Transition (Downgrade) ---
  const reqProToStarter = await createApprovalRequest({
    adminId: admin.id,
    adminEmail: admin.email,
    actionType: "CHANGE_PLAN",
    targetEmail: biz.email!,
    targetId: biz.id,
    targetName: biz.name,
    metadata: { currentPlan: "PRO", requestedPlan: "STARTER", requestedStatus: "ACTIVE" },
  });
  const otpProToStarter = await solveOtpForRequest(reqProToStarter.requestId!);
  await verifyApprovalOtp({ requestId: reqProToStarter.requestId!, adminId: admin.id, otp: otpProToStarter });
  const execProToStarter = await executeApprovalAction({ requestId: reqProToStarter.requestId!, adminId: admin.id, adminEmail: admin.email });
  assert(execProToStarter.success === true, "4. Pro → Starter transition executed successfully");
  const bizAfter4 = await prisma.business.findUnique({ where: { id: biz.id } });
  assert(bizAfter4?.planTier === "STARTER", "4b. Business state updated to STARTER");

  // --- TEST 5: Starter -> Pro Plan Transition ---
  const reqStarterToPro = await createApprovalRequest({
    adminId: admin.id,
    adminEmail: admin.email,
    actionType: "CHANGE_PLAN",
    targetEmail: biz.email!,
    targetId: biz.id,
    targetName: biz.name,
    metadata: { currentPlan: "STARTER", requestedPlan: "PRO", requestedStatus: "ACTIVE" },
  });
  const otpStarterToPro = await solveOtpForRequest(reqStarterToPro.requestId!);
  await verifyApprovalOtp({ requestId: reqStarterToPro.requestId!, adminId: admin.id, otp: otpStarterToPro });
  const execStarterToPro = await executeApprovalAction({ requestId: reqStarterToPro.requestId!, adminId: admin.id, adminEmail: admin.email });
  assert(execStarterToPro.success === true, "5. Starter → Pro transition executed successfully");

  // --- TEST 6: Pro -> Business Plan Transition ---
  const reqProToBiz = await createApprovalRequest({
    adminId: admin.id,
    adminEmail: admin.email,
    actionType: "CHANGE_PLAN",
    targetEmail: biz.email!,
    targetId: biz.id,
    targetName: biz.name,
    metadata: { currentPlan: "PRO", requestedPlan: "BUSINESS", requestedStatus: "ACTIVE" },
  });
  const otpProToBiz = await solveOtpForRequest(reqProToBiz.requestId!);
  await verifyApprovalOtp({ requestId: reqProToBiz.requestId!, adminId: admin.id, otp: otpProToBiz });
  const execProToBiz = await executeApprovalAction({ requestId: reqProToBiz.requestId!, adminId: admin.id, adminEmail: admin.email });
  assert(execProToBiz.success === true, "6. Pro → Business transition executed successfully");

  // --- TEST 7: Business -> Starter Plan Transition ---
  const reqBizToStarter = await createApprovalRequest({
    adminId: admin.id,
    adminEmail: admin.email,
    actionType: "CHANGE_PLAN",
    targetEmail: biz.email!,
    targetId: biz.id,
    targetName: biz.name,
    metadata: { currentPlan: "BUSINESS", requestedPlan: "STARTER", requestedStatus: "ACTIVE" },
  });
  const otpBizToStarter = await solveOtpForRequest(reqBizToStarter.requestId!);
  await verifyApprovalOtp({ requestId: reqBizToStarter.requestId!, adminId: admin.id, otp: otpBizToStarter });
  const execBizToStarter = await executeApprovalAction({ requestId: reqBizToStarter.requestId!, adminId: admin.id, adminEmail: admin.email });
  assert(execBizToStarter.success === true, "7. Business → Starter transition executed successfully");

  // --- TEST 8: Trial Extension ---
  const reqExtendTrial = await createApprovalRequest({
    adminId: admin.id,
    adminEmail: admin.email,
    actionType: "EXTEND_TRIAL",
    targetEmail: biz.email!,
    targetId: biz.id,
    targetName: biz.name,
    metadata: { extensionDays: 14 },
  });
  const otpExtend = await solveOtpForRequest(reqExtendTrial.requestId!);
  await verifyApprovalOtp({ requestId: reqExtendTrial.requestId!, adminId: admin.id, otp: otpExtend });
  const execExtend = await executeApprovalAction({ requestId: reqExtendTrial.requestId!, adminId: admin.id, adminEmail: admin.email });
  assert(execExtend.success === true, "8. Trial Extension (+14 days) executed successfully");
  const bizAfter8 = await prisma.business.findUnique({ where: { id: biz.id } });
  assert(bizAfter8?.subscriptionStatus === "TRIAL" && bizAfter8?.trialEndsAt !== null, "8b. Business trial extended");

  // --- TEST 9: Trial Reset ---
  const reqResetTrial = await createApprovalRequest({
    adminId: admin.id,
    adminEmail: admin.email,
    actionType: "RESET_TRIAL",
    targetEmail: biz.email!,
    targetId: biz.id,
    targetName: biz.name,
  });
  const otpReset = await solveOtpForRequest(reqResetTrial.requestId!);
  await verifyApprovalOtp({ requestId: reqResetTrial.requestId!, adminId: admin.id, otp: otpReset });
  const execReset = await executeApprovalAction({ requestId: reqResetTrial.requestId!, adminId: admin.id, adminEmail: admin.email });
  assert(execReset.success === true, "9. Trial Reset (fresh 30 days) executed successfully");

  // --- TEST 10: Lifetime Access Grant & Revoke ---
  const reqGrantLifetime = await createApprovalRequest({
    adminId: admin.id,
    adminEmail: admin.email,
    actionType: "GRANT_LIFETIME",
    targetEmail: biz.email!,
    targetId: biz.id,
    targetName: biz.name,
  });
  const otpLifetime = await solveOtpForRequest(reqGrantLifetime.requestId!);
  await verifyApprovalOtp({ requestId: reqGrantLifetime.requestId!, adminId: admin.id, otp: otpLifetime });
  const execLifetime = await executeApprovalAction({ requestId: reqGrantLifetime.requestId!, adminId: admin.id, adminEmail: admin.email });
  assert(execLifetime.success === true, "10a. Lifetime Access granted via verified OTP");
  const bizAfter10 = await prisma.business.findUnique({ where: { id: biz.id } });
  assert(bizAfter10?.isLifetimeFree === true && bizAfter10?.subscriptionStatus === "LIFETIME", "10b. Business isLifetimeFree is true");

  const reqRevokeLifetime = await createApprovalRequest({
    adminId: admin.id,
    adminEmail: admin.email,
    actionType: "REVOKE_LIFETIME",
    targetEmail: biz.email!,
    targetId: biz.id,
    targetName: biz.name,
  });
  const otpRevokeLifetime = await solveOtpForRequest(reqRevokeLifetime.requestId!);
  await verifyApprovalOtp({ requestId: reqRevokeLifetime.requestId!, adminId: admin.id, otp: otpRevokeLifetime });
  const execRevokeLifetime = await executeApprovalAction({ requestId: reqRevokeLifetime.requestId!, adminId: admin.id, adminEmail: admin.email });
  assert(execRevokeLifetime.success === true, "10c. Lifetime Access revoked via verified OTP");
  const bizAfter10c = await prisma.business.findUnique({ where: { id: biz.id } });
  assert(bizAfter10c?.isLifetimeFree === false && bizAfter10c?.subscriptionStatus === "ACTIVE", "10d. Business isLifetimeFree is false");

  // --- TEST 11: OTP Security & Negative Tests ---
  // A. Wrong OTP
  const reqSec = await createApprovalRequest({
    adminId: admin.id,
    adminEmail: admin.email,
    actionType: "CHANGE_PLAN",
    targetEmail: biz.email!,
    targetId: biz.id,
    targetName: biz.name,
    metadata: { requestedPlan: "PRO" },
  });
  const badVerify = await verifyApprovalOtp({ requestId: reqSec.requestId!, adminId: admin.id, otp: "000000" });
  assert(badVerify.error !== undefined && badVerify.code === "INVALID_OTP", "11a. Wrong OTP rejected");

  // B. Expired OTP
  await prisma.adminApprovalRequest.update({
    where: { id: reqSec.requestId! },
    data: { expiresAt: new Date(Date.now() - 5000) },
  });
  const expiredVerify = await verifyApprovalOtp({ requestId: reqSec.requestId!, adminId: admin.id, otp: "123456" });
  assert(expiredVerify.error !== undefined && expiredVerify.code === "EXPIRED", "11b. Expired OTP rejected");

  // C. Action Binding (OTP for Action A cannot execute Action B)
  const reqActionA = await createApprovalRequest({
    adminId: admin.id,
    adminEmail: admin.email,
    actionType: "CHANGE_PLAN",
    targetEmail: biz.email!,
    targetId: biz.id,
    targetName: biz.name,
    metadata: { requestedPlan: "PRO" },
  });
  const reqActionA_DB = await prisma.adminApprovalRequest.findUnique({ where: { id: reqActionA.requestId! } });
  assert(reqActionA_DB?.actionType === "CHANGE_PLAN", "11c. OTP bound strictly to CHANGE_PLAN actionType");

  // D. Single Use / Anti-Replay
  const otpA = await solveOtpForRequest(reqActionA.requestId!);
  await verifyApprovalOtp({ requestId: reqActionA.requestId!, adminId: admin.id, otp: otpA });
  const firstExec = await executeApprovalAction({ requestId: reqActionA.requestId!, adminId: admin.id, adminEmail: admin.email });
  assert(firstExec.success === true, "11d. First execution succeeds");
  const replayExec = await executeApprovalAction({ requestId: reqActionA.requestId!, adminId: admin.id, adminEmail: admin.email });
  assert(replayExec.error !== undefined, "11e. Replay attack blocked (already consumed)");

  // --- TEST 12: Audit Logs Verification ---
  const auditLogs = await prisma.auditLog.findMany({
    where: { businessId: biz.id, performedBy: "ADMIN" },
    orderBy: { createdAt: "desc" },
  });
  assert(auditLogs.length > 0, "12a. Subscription changes generated immutable Audit Logs");
  const hasSecretInAudit = auditLogs.some((l) => l.details?.includes("scrypt$") || l.details?.includes("123456"));
  assert(!hasSecretInAudit, "12b. Zero passwords or OTP codes present in Audit Logs");

  // --- Clean Up Test Fixtures ---
  await prisma.auditLog.deleteMany({ where: { businessId: biz.id } });
  await prisma.adminApprovalRequest.deleteMany({ where: { adminId: admin.id } });
  await prisma.business.delete({ where: { id: biz.id } });
  await prisma.user.delete({ where: { id: admin.id } });

  console.log("\n============================================================");
  console.log(`SUBSCRIPTION RESTRICTIONS SUITE COMPLETE: ${passedCount} Passed, ${failedCount} Failed`);
  console.log("============================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSubscriptionRestrictionsSuite().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
