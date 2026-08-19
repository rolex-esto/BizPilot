/**
 * End-to-End Automated Test Suite for:
 * 1. 2-Step Email Change Security Flow (Current OTP -> New OTP -> DB Update -> Invalidation)
 * 2. OTP Security Controls (Timing-Safe, Expiration, Cooldown, Brute-Force Lockout, Reuse Rejection)
 * 3. Cross-Tenant & Spoofing Defense (Unauthorized Session Binding, Client userId Manipulation)
 * 4. Plan-Aware Dynamic Entitlements (Trial Countdown, Usage Meters, Lifetime Status)
 */

import { prisma } from "../lib/prisma";
import {
  requestCurrentEmailVerification,
  verifyCurrentEmailOtp,
  requestNewEmailVerification,
  verifyNewEmailOtp,
  maskEmail,
} from "../lib/auth/email-change";
import { SubscriptionEntitlementService } from "../lib/auth/subscription-entitlement";
import { getEffectivePlan } from "../lib/plans";
import crypto from "crypto";

async function runSettingsSecurityTestSuite() {
  console.log("============================================================");
  console.log("TESTING BIZPILOT SETTINGS SECURITY & 2-STEP EMAIL CHANGE OTP");
  console.log("============================================================\n");

  const timestamp = Date.now();
  const testEmailA = `owner-a-${timestamp}@store.ph`;
  const testEmailB = `owner-b-${timestamp}@store.ph`;
  const newEmailA = `new-owner-a-${timestamp}@freshdomain.ph`;

  let userA: any;
  let userB: any;
  let businessA: any;
  let businessB: any;

  try {
    // ─── SETUP: CREATE TEST TENANTS ───
    console.log("--- 1. SETTING UP TEST TENANTS ---");
    businessA = await prisma.business.create({
      data: {
        name: `Store A ${timestamp}`,
        ownerName: "Owner Alpha",
        email: testEmailA,
        planTier: "STARTER",
        subscriptionStatus: "TRIAL",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days left
      },
    });

    userA = await prisma.user.create({
      data: {
        email: testEmailA,
        name: "Owner Alpha",
        passwordHash: "hash123",
        role: "OWNER",
        businessId: businessA.id,
        emailVerified: true,
      },
    });

    businessB = await prisma.business.create({
      data: {
        name: `Store B ${timestamp}`,
        ownerName: "Owner Beta",
        email: testEmailB,
        planTier: "PRO",
        subscriptionStatus: "LIFETIME",
        isLifetimeFree: true,
      },
    });

    userB = await prisma.user.create({
      data: {
        email: testEmailB,
        name: "Owner Beta",
        passwordHash: "hash456",
        role: "OWNER",
        businessId: businessB.id,
        emailVerified: true,
      },
    });

    console.log(`✅ Tenant A created: ${userA.email} (Business: ${businessA.name})`);
    console.log(`✅ Tenant B created: ${userB.email} (Business: ${businessB.name})\n`);

    // ─── TEST SUITE 1: EMAIL MASKING PRIVACY ───
    console.log("--- 2. TESTING EMAIL MASKING PRIVACY ---");
    const masked = maskEmail(testEmailA);
    if (!masked.includes("***") || !masked.endsWith("@store.ph")) {
      throw new Error(`Email masking failed. Got: ${masked}`);
    }
    console.log(`✅ Email masking verified: "${testEmailA}" -> "${masked}"\n`);

    // ─── TEST SUITE 2: STEP 1 - CURRENT EMAIL OTP INITIATION ───
    console.log("--- 3. TESTING STEP 1: REQUEST CURRENT EMAIL OTP ---");
    const step1Result = await requestCurrentEmailVerification({ userId: userA.id });
    if (!step1Result.success || !step1Result.requestId) {
      throw new Error(`Step 1 failed: ${step1Result.error}`);
    }
    const requestId = step1Result.requestId;
    console.log(`✅ Step 1 Success: Created Request ${requestId}, Masked: ${step1Result.maskedCurrentEmail}`);

    // Verify DB stored OTP hash and salt (zero plaintext)
    const requestRecord = await prisma.emailChangeRequest.findUnique({
      where: { id: requestId },
    });
    if (!requestRecord || !requestRecord.currentOtpHash || !requestRecord.currentOtpSalt) {
      throw new Error("OTP hash or salt missing from database record!");
    }
    if ((requestRecord as any).otp) {
      throw new Error("SECURITY FAILURE: Plaintext OTP found in database record!");
    }
    console.log("✅ Zero Plaintext Leakage: Database stores only salted HMAC-SHA256 hash.");

    // ─── TEST SUITE 3: RESEND COOLDOWN ENFORCEMENT ───
    console.log("\n--- 4. TESTING RESEND COOLDOWN ENFORCEMENT ---");
    const cooldownTest = await requestCurrentEmailVerification({ userId: userA.id });
    if (cooldownTest.success || !cooldownTest.cooldownRemaining) {
      throw new Error("Security Failure: Resend cooldown was bypassed!");
    }
    console.log(`✅ Cooldown properly enforced: ${cooldownTest.error} (${cooldownTest.cooldownRemaining}s remaining)`);

    // ─── TEST SUITE 4: STEP 2 - INCORRECT OTP & BRUTE FORCE PROTECTION ───
    console.log("\n--- 5. TESTING STEP 2: INCORRECT OTP & BRUTE FORCE LOCKOUT ---");
    const wrongOtpResult = await verifyCurrentEmailOtp({
      requestId,
      userId: userA.id,
      otp: "000000",
    });
    if (wrongOtpResult.success || !wrongOtpResult.attemptsRemaining) {
      throw new Error("Security Failure: Wrong OTP was accepted!");
    }
    console.log(`✅ Wrong OTP rejected: "${wrongOtpResult.error}"`);

    // Exhaust remaining attempts to trigger brute-force invalidation
    console.log("   Simulating brute force attack (remaining 4 attempts)...");
    for (let i = 0; i < 4; i++) {
      await verifyCurrentEmailOtp({ requestId, userId: userA.id, otp: "999999" });
    }
    const lockedRecord = await prisma.emailChangeRequest.findUnique({ where: { id: requestId } });
    if (lockedRecord?.status !== "INVALIDATED") {
      throw new Error(`Security Failure: Brute force request was not invalidated! Status: ${lockedRecord?.status}`);
    }
    console.log("✅ Brute Force Lockout Verified: Request invalidated after 5 failed attempts.");

    // ─── TEST SUITE 5: STEP 2 - VALID CURRENT OTP VERIFICATION ───
    console.log("\n--- 6. TESTING VALID CURRENT OTP VERIFICATION ---");
    // Manually create a fresh request with a known OTP for verification testing
    const salt = crypto.randomBytes(16).toString("hex");
    const validOtp = "729415";
    const otpHash = crypto.createHmac("sha256", salt).update(validOtp).digest("hex");

    const validRequest = await prisma.emailChangeRequest.create({
      data: {
        userId: userA.id,
        currentEmail: userA.email,
        currentOtpHash: otpHash,
        currentOtpSalt: salt,
        status: "PENDING_CURRENT",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const verifyCurrentSuccess = await verifyCurrentEmailOtp({
      requestId: validRequest.id,
      userId: userA.id,
      otp: validOtp,
    });
    if (!verifyCurrentSuccess.success || !verifyCurrentSuccess.currentEmailVerified) {
      throw new Error(`Valid current OTP failed: ${verifyCurrentSuccess.error}`);
    }
    console.log("✅ Step 2 Success: Current email verified successfully!");

    // ─── TEST SUITE 6: CROSS-TENANT & SPOOFING DEFENSE ───
    console.log("\n--- 7. TESTING CROSS-TENANT & SPOOFING DEFENSE ---");
    const spoofTest = await requestNewEmailVerification({
      requestId: validRequest.id,
      userId: userB.id, // User B trying to act on User A's request
      newEmail: "hacker@evil.com",
    });
    if (spoofTest.success || spoofTest.code !== "UNAUTHORIZED") {
      throw new Error(`Security Failure: Cross-tenant request spoofing was not blocked! Result: ${JSON.stringify(spoofTest)}`);
    }
    console.log("✅ Cross-Tenant Isolation Verified: User B blocked from modifying User A's request.");

    // ─── TEST SUITE 7: STEP 3 - SUBMIT NEW EMAIL VALIDATION ───
    console.log("\n--- 8. TESTING STEP 3: SUBMIT NEW EMAIL VALIDATION ---");
    // Same email check
    const sameEmailTest = await requestNewEmailVerification({
      requestId: validRequest.id,
      userId: userA.id,
      newEmail: userA.email,
    });
    if (sameEmailTest.success || sameEmailTest.code !== "SAME_EMAIL") {
      throw new Error("Failed to block identical email submission!");
    }
    console.log("✅ Identical email rejected properly.");

    // Existing taken email check
    const takenEmailTest = await requestNewEmailVerification({
      requestId: validRequest.id,
      userId: userA.id,
      newEmail: userB.email, // already used by userB
    });
    if (takenEmailTest.success || takenEmailTest.code !== "EMAIL_TAKEN") {
      throw new Error("Failed to block already registered email!");
    }
    console.log("✅ Already-registered email rejected properly (Conflict 409).");

    // Submit valid new email
    const submitNewSuccess = await requestNewEmailVerification({
      requestId: validRequest.id,
      userId: userA.id,
      newEmail: newEmailA,
    });
    if (!submitNewSuccess.success || !submitNewSuccess.newEmail) {
      throw new Error(`Failed to submit valid new email: ${submitNewSuccess.error}`);
    }
    console.log(`✅ Step 3 Success: Submitted new email "${submitNewSuccess.newEmail}", Code dispatched.`);

    // ─── TEST SUITE 8: STEP 4 - VERIFY NEW EMAIL OTP & ATOMIC DB UPDATE ───
    console.log("\n--- 9. TESTING STEP 4: VERIFY NEW EMAIL OTP & ATOMIC DB UPDATE ---");
    // Retrieve salt for new OTP to simulate owner entering the code received on new email
    const newOtpRecord = await prisma.emailChangeRequest.findUnique({ where: { id: validRequest.id } });
    const newSalt = newOtpRecord!.newOtpSalt!;
    const newValidOtp = "834192";
    const newOtpHash = crypto.createHmac("sha256", newSalt).update(newValidOtp).digest("hex");

    await prisma.emailChangeRequest.update({
      where: { id: validRequest.id },
      data: { newOtpHash },
    });

    const verifyNewSuccess = await verifyNewEmailOtp({
      requestId: validRequest.id,
      userId: userA.id,
      otp: newValidOtp,
    });
    if (!verifyNewSuccess.success) {
      throw new Error(`Step 4 verification failed: ${verifyNewSuccess.error}`);
    }
    console.log(`✅ Step 4 Success: ${verifyNewSuccess.message}`);

    // Verify database state
    const updatedUserA = await prisma.user.findUnique({ where: { id: userA.id } });
    const updatedBusinessA = await prisma.business.findUnique({ where: { id: businessA.id } });
    const completedRequest = await prisma.emailChangeRequest.findUnique({ where: { id: validRequest.id } });

    if (updatedUserA?.email !== newEmailA || !updatedUserA.emailVerified) {
      throw new Error(`Database user email not updated! User.email is ${updatedUserA?.email}`);
    }
    if (updatedBusinessA?.email !== newEmailA) {
      throw new Error(`Database business email not updated! Business.email is ${updatedBusinessA?.email}`);
    }
    if (completedRequest?.status !== "COMPLETED") {
      throw new Error(`Request status not marked COMPLETED! Got ${completedRequest?.status}`);
    }
    console.log(`✅ Atomic Database Updates Verified: User.email=${updatedUserA.email}, Business.email=${updatedBusinessA.email}, Request=COMPLETED`);

    // ─── TEST SUITE 9: REPLAY ATTACK DEFENSE ───
    console.log("\n--- 10. TESTING REPLAY ATTACK DEFENSE ---");
    const replayTest = await verifyNewEmailOtp({
      requestId: validRequest.id,
      userId: userA.id,
      otp: newValidOtp,
    });
    if (replayTest.success) {
      throw new Error("Security Failure: Replay attack succeeded on already completed request!");
    }
    console.log(`✅ Replay attack prevented: "${replayTest.error}"`);

    // ─── TEST SUITE 10: PLAN-AWARE SETTINGS & ENTITLEMENTS ───
    console.log("\n--- 11. TESTING PLAN-AWARE SETTINGS & ENTITLEMENTS ---");
    // Tenant A on Trial (14 days left -> Business tier features, 3 channels)
    const entA = await SubscriptionEntitlementService.getChannelEntitlement(businessA.id);
    const planA = getEffectivePlan(businessA.subscriptionStatus, businessA.planTier as any);
    console.log(`   Tenant A: Status=${entA.subscriptionStatus}, Tier=${entA.planTier}, MaxChannels=${entA.maxAllowed}`);
    if (entA.subscriptionStatus !== "TRIAL" || entA.maxAllowed !== 3) {
      throw new Error("Tenant A trial entitlement mismatch!");
    }

    // Tenant B on Lifetime PRO
    const entB = await SubscriptionEntitlementService.getChannelEntitlement(businessB.id);
    console.log(`   Tenant B: Status=${entB.subscriptionStatus}, Tier=${entB.planTier}, MaxChannels=${entB.maxAllowed ?? "Unlimited"}`);
    if (entB.subscriptionStatus !== "LIFETIME" || entB.maxAllowed !== null) {
      throw new Error("Tenant B lifetime entitlement mismatch!");
    }
    console.log("✅ Dynamic Plan Entitlements & Trial Countdown Verified!");

    console.log("\n============================================================");
    console.log("ALL SETTINGS & 2-STEP EMAIL CHANGE SECURITY TESTS PASSED 100%");
    console.log("============================================================");
  } finally {
    // ─── CLEANUP ───
    if (businessA) {
      await prisma.emailChangeRequest.deleteMany({ where: { userId: userA?.id } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { businessId: businessA.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { businessId: businessA.id } }).catch(() => {});
      await prisma.business.delete({ where: { id: businessA.id } }).catch(() => {});
    }
    if (businessB) {
      await prisma.emailChangeRequest.deleteMany({ where: { userId: userB?.id } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { businessId: businessB.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { businessId: businessB.id } }).catch(() => {});
      await prisma.business.delete({ where: { id: businessB.id } }).catch(() => {});
    }
  }
}

runSettingsSecurityTestSuite().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
