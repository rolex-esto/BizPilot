import { prisma } from "../lib/prisma";
import {
  createApprovalRequest,
  verifyApprovalOtp,
  executeApprovalAction,
} from "../lib/auth/admin-approval";
import { getEffectivePlan, PLANS } from "../lib/plans";
import { SubscriptionEntitlementService } from "../lib/auth/subscription-entitlement";

async function runLifetimeAccessValidation() {
  console.log("\n============================================================");
  console.log("TESTING & VALIDATING GRANT LIFETIME ACCESS FLOW");
  console.log("============================================================\n");

  const timestamp = Date.now();
  const testAdminEmail = `admin-lifetime-test-${timestamp}@bizpilot.ph`;
  const testUserEmail = `owner-lifetime-test-${timestamp}@store.ph`;
  const storeName = `Lifetime Test Store ${timestamp}`;

  try {
    // 1. Setup Admin Account
    const admin = await prisma.user.create({
      data: {
        email: testAdminEmail,
        name: "Super Admin Tester",
        role: "ADMIN",
        passwordHash: "test_hash_secure",
        emailVerified: true,
      },
    });
    console.log(`✅ [1/7] Created Test Admin: ${admin.email} (Role: ${admin.role})`);

    // 2. Setup Business & Owner Account (Initially on Trial / Starter)
    const business = await prisma.business.create({
      data: {
        name: storeName,
        ownerName: "Juan Lifetime Tester",
        email: testUserEmail,
        planTier: "STARTER",
        subscriptionStatus: "TRIAL",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
        isLifetimeFree: false,
      },
    });

    const user = await prisma.user.create({
      data: {
        email: testUserEmail,
        name: "Juan Lifetime Tester",
        role: "OWNER",
        businessId: business.id,
        passwordHash: "test_hash_secure",
        emailVerified: true,
      },
    });
    console.log(`✅ [2/7] Created Test Store & Owner: "${business.name}" (${user.email}) — Status: ${business.subscriptionStatus}, Lifetime: ${business.isLifetimeFree}`);

    // Verify initial entitlement
    let entitlement = await SubscriptionEntitlementService.getChannelEntitlement(business.id);
    console.log(`   Initial Entitlement: Status=${entitlement.subscriptionStatus}, Tier=${entitlement.planTier}`);

    // 3. Initiate Grant Lifetime Access Request using User's login email
    console.log("\n--- INITIATING GRANT_LIFETIME REQUEST ---");
    const requestResult = await createApprovalRequest({
      adminId: admin.id,
      adminEmail: admin.email,
      actionType: "GRANT_LIFETIME",
      targetEmail: user.email,
      targetId: business.id,
      targetName: business.name,
    });

    if (!requestResult.success || !requestResult.requestId) {
      throw new Error(`Failed to create approval request: ${requestResult.error}`);
    }
    console.log(`✅ [3/7] Approval Request Created: Request ID = ${requestResult.requestId}`);

    // Fetch the raw OTP from the database record for automated testing
    const dbRequest = await prisma.adminApprovalRequest.findUnique({
      where: { id: requestResult.requestId },
    });
    if (!dbRequest) throw new Error("Approval request not found in database.");

    // Test with invalid OTP first
    const invalidVerify = await verifyApprovalOtp({
      requestId: requestResult.requestId,
      adminId: admin.id,
      otp: "000000",
    });
    if (invalidVerify.success) throw new Error("Security failure: Invalid OTP was accepted!");
    console.log(`✅ [4/7] Invalid OTP correctly rejected: ${invalidVerify.error}`);

    // 4. Verify with the matching valid OTP using internal salt
    const testOtp = "789123";
    const { hashOtp } = await import("../lib/auth/admin-approval");
    const testSalt = dbRequest.salt;
    const testHash = hashOtp(testOtp, testSalt);

    await prisma.adminApprovalRequest.update({
      where: { id: requestResult.requestId },
      data: { otpHash: testHash, attempts: 0 },
    });

    const validVerify = await verifyApprovalOtp({
      requestId: requestResult.requestId,
      adminId: admin.id,
      otp: testOtp,
    });

    if (!validVerify.success) {
      throw new Error(`Valid OTP verification failed: ${validVerify.error}`);
    }
    console.log(`✅ [5/7] Valid OTP verified successfully! Status = VERIFIED`);

    // 5. Execute Confirmed Action
    console.log("\n--- EXECUTING CONFIRMED ACTION ---");
    const executionResult = await executeApprovalAction({
      requestId: requestResult.requestId,
      adminId: admin.id,
      adminEmail: admin.email,
    });

    if (!executionResult.success) {
      throw new Error(`Execution failed: ${executionResult.error}`);
    }
    console.log(`✅ [6/7] Execution Success: "${executionResult.message}"`);

    // 6. Verify Database & Entitlements After Granting Lifetime Access
    console.log("\n--- VERIFYING POST-GRANT LIFETIME STATE ---");
    const updatedBiz = await prisma.business.findUnique({
      where: { id: business.id },
    });

    if (!updatedBiz) throw new Error("Business not found after update.");

    console.log(`   Database isLifetimeFree: ${updatedBiz.isLifetimeFree} (Expected: true)`);
    console.log(`   Database subscriptionStatus: ${updatedBiz.subscriptionStatus} (Expected: LIFETIME)`);
    console.log(`   Database planTier: ${updatedBiz.planTier} (Expected: PRO)`);
    console.log(`   Database trialEndsAt: ${updatedBiz.trialEndsAt} (Expected: null)`);

    if (!updatedBiz.isLifetimeFree || updatedBiz.subscriptionStatus !== "LIFETIME" || updatedBiz.planTier !== "PRO") {
      throw new Error("Validation failure: Database state does not match Lifetime Access requirements.");
    }

    const postEntitlement = await SubscriptionEntitlementService.getChannelEntitlement(business.id);
    console.log(`   Post-Grant Entitlement: Status=${postEntitlement.subscriptionStatus}, Tier=${postEntitlement.planTier}, MaxChannels=${postEntitlement.maxAllowed}`);

    if (postEntitlement.subscriptionStatus !== "LIFETIME" || postEntitlement.planTier !== "PRO" || postEntitlement.maxAllowed !== null) {
      throw new Error("Validation failure: SubscriptionEntitlementService did not return Lifetime PRO limits.");
    }

    const effectivePlan = getEffectivePlan(updatedBiz.subscriptionStatus, updatedBiz.planTier);
    if (effectivePlan.id !== "PRO" || effectivePlan.limits.maxConnectedChannels !== null) {
      throw new Error("Validation failure: getEffectivePlan did not return PRO plan configuration.");
    }

    console.log(`✅ [7/7] ALL LIFETIME ACCESS CHECKS PASSED: Store "${updatedBiz.name}" has permanent PRO access with unlimited channels!`);

    // Clean up test data
    await prisma.adminApprovalRequest.deleteMany({ where: { adminId: admin.id } });
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, user.id] } } });
    await prisma.business.deleteMany({ where: { id: business.id } });
    console.log("\n🧹 Cleaned up temporary test accounts.");

    console.log("\n============================================================");
    console.log("LIFETIME ACCESS VALIDATION PASSED 100%");
    console.log("============================================================\n");
  } catch (err: any) {
    console.error("❌ Lifetime access validation error:", err);
    process.exit(1);
  }
}

runLifetimeAccessValidation();
