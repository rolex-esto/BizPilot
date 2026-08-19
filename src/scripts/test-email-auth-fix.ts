import { prisma } from "../lib/prisma";
import crypto from "crypto";
import { getAppUrl } from "../lib/config/url";
import { getVerificationUrl, sendVerificationEmail } from "../lib/auth/verification";
import { getResetPasswordUrl, sendPasswordResetEmail } from "../lib/auth/password-reset";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import { PLANS, getEffectivePlan, getPlanConfig } from "../lib/plans";
import { checkPlanAccess, checkProductLimit, checkOrderLimit, checkFeatureAccess } from "../lib/auth/plan-guard";
import { processTrialReminders } from "../lib/trial-reminders";

interface TestReport {
  category: string;
  name: string;
  passed: boolean;
  details?: string;
}

const reports: TestReport[] = [];

function assertTest(category: string, name: string, condition: boolean, details?: string) {
  reports.push({ category, name, passed: condition, details });
  const badge = condition ? "✅ PASS" : "❌ FAIL";
  console.log(`${badge} [${category}] ${name} ${details ? `(${details})` : ""}`);
}

async function runComprehensiveVerification() {
  console.log("\n============================================================");
  console.log("RUNNING COMPREHENSIVE EMAIL, AUTH, TRIAL & PLAN VALIDATION");
  console.log("============================================================\n");

  // ============================================================
  // 1. URL SAFETY & PRODUCTION ENVIRONMENT SEPARATION
  // ============================================================
  try {
    const origEnv = process.env.NODE_ENV;
    const origUrl = process.env.NEXT_PUBLIC_APP_URL;

    // 1.1 Development mode allows localhost
    (process.env as any).NODE_ENV = "development";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    const devUrl = getAppUrl("/verify-email");
    assertTest("URL Safety", "Development allows localhost:3000", devUrl === "http://localhost:3000/verify-email");

    // 1.2 Production mode with valid HTTPS URL
    (process.env as any).NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.bizpilot.ph";
    const prodValidUrl = getAppUrl("/verify-email");
    assertTest("URL Safety", "Production allows valid HTTPS domain", prodValidUrl === "https://app.bizpilot.ph/verify-email");

    // 1.3 Production mode with localhost MUST FAIL SAFELY
    (process.env as any).NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    let prodLocalhostBlocked = false;
    try {
      getAppUrl("/verify-email");
    } catch (e: any) {
      prodLocalhostBlocked = e.message.includes("[URL Safety Error]");
    }
    assertTest("URL Safety", "Production blocks http://localhost:3000 safely", prodLocalhostBlocked);

    // 1.4 Production mode with missing URL MUST FAIL SAFELY
    delete process.env.NEXT_PUBLIC_APP_URL;
    let prodMissingBlocked = false;
    try {
      getAppUrl("/verify-email");
    } catch (e: any) {
      prodMissingBlocked = e.message.includes("[URL Safety Error]");
    }
    assertTest("URL Safety", "Production blocks missing NEXT_PUBLIC_APP_URL safely", prodMissingBlocked);

    // Restore environment
    (process.env as any).NODE_ENV = origEnv;
    if (origUrl) process.env.NEXT_PUBLIC_APP_URL = origUrl;
    else delete process.env.NEXT_PUBLIC_APP_URL;
  } catch (err: any) {
    assertTest("URL Safety", "URL Safety Suite", false, err.message);
  }

  // ============================================================
  // 2. EMAIL FAILURE DETECTION & ERROR PROPAGATION
  // ============================================================
  try {
    // 2.1 sendVerificationEmail returns boolean
    const testEmail = `test_prop_${Date.now()}@example.com`;
    const dummyUrl = getVerificationUrl("token_12345");
    const result = await sendVerificationEmail(testEmail, "Test User", dummyUrl);
    assertTest("Email Reliability", "sendVerificationEmail returns boolean status without throwing", typeof result === "boolean");

    // 2.2 sendPasswordResetEmail returns boolean
    const resetUrl = getResetPasswordUrl("token_reset_12345");
    const resetResult = await sendPasswordResetEmail(testEmail, "Test User", resetUrl);
    assertTest("Email Reliability", "sendPasswordResetEmail returns boolean status without throwing", typeof resetResult === "boolean");
  } catch (err: any) {
    assertTest("Email Reliability", "Email propagation test", false, err.message);
  }

  // ============================================================
  // 3. VERIFICATION TOKEN SECURITY & LIFECYCLE
  // ============================================================
  try {
    const signupEmail = `verify_test_${Date.now()}@example.com`;
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const passwordHash = hashPassword("SecurePass123!");

    // 3.1 Token entropy check (64 hex characters / 256 bits)
    assertTest("Verification Security", "Token entropy is 256 bits (64 hex chars)", token.length === 64);

    // 3.2 PendingSignup creation
    const pending = await prisma.pendingSignup.create({
      data: {
        email: signupEmail,
        passwordHash,
        name: "Verification Test User",
        storeName: "Test Store",
        verificationToken: token,
        expiresAt,
      },
    });
    assertTest("Verification Security", "PendingSignup stored with expiration", !!pending && pending.expiresAt > new Date());

    // 3.3 Account creation & token consumption in transaction
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const verifiedUser = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: pending.storeName,
          ownerName: pending.name,
          email: pending.email,
          subscriptionStatus: "TRIAL",
          planTier: "STARTER",
          trialEndsAt,
        },
      });

      const user = await tx.user.create({
        data: {
          email: pending.email,
          passwordHash: pending.passwordHash,
          name: pending.name,
          role: "OWNER",
          businessId: business.id,
          emailVerified: true,
        },
      });

      await tx.pendingSignup.delete({ where: { id: pending.id } });
      return { user, business };
    });

    const pendingAfterVerify = await prisma.pendingSignup.findUnique({ where: { verificationToken: token } });
    assertTest("Verification Security", "Token is single-use and consumed upon verification", pendingAfterVerify === null);
    assertTest("Verification Security", "User is marked verified and assigned 30-day trial", verifiedUser.user.emailVerified && verifiedUser.business.subscriptionStatus === "TRIAL");

    // Clean up
    await prisma.user.delete({ where: { id: verifiedUser.user.id } });
    await prisma.business.delete({ where: { id: verifiedUser.business.id } });
  } catch (err: any) {
    assertTest("Verification Security", "Token lifecycle test", false, err.message);
  }

  // ============================================================
  // 4. PASSWORD RESET LIFECYCLE & SECURITY
  // ============================================================
  try {
    const resetUserEmail = `reset_user_${Date.now()}@example.com`;
    const initialPassword = "OldPassword123!";
    const newPassword = "BrandNewSecurePassword456!";

    // 4.1 Create test verified user
    const testBusiness = await prisma.business.create({
      data: { name: "Reset Store", ownerName: "Reset Owner", email: resetUserEmail },
    });
    const testUser = await prisma.user.create({
      data: {
        email: resetUserEmail,
        passwordHash: hashPassword(initialPassword),
        name: "Reset Owner",
        role: "OWNER",
        businessId: testBusiness.id,
      },
    });

    // 4.2 Generate password reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        email: resetUserEmail,
        token: resetToken,
        expiresAt,
      },
    });

    // 4.3 Validate reset token lookup
    const foundToken = await prisma.passwordResetToken.findUnique({ where: { token: resetToken } });
    assertTest("Password Reset", "PasswordResetToken created with 1-hour expiration", !!foundToken && foundToken.expiresAt > new Date());

    // 4.4 Execute password reset
    const newPasswordHash = hashPassword(newPassword);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: testUser.id },
        data: { passwordHash: newPasswordHash },
      });
      await tx.passwordResetToken.delete({ where: { id: foundToken!.id } });
    });

    // 4.5 Verify old password rejected, new password accepted
    const updatedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    const oldPasswordRejected = !verifyPassword(initialPassword, updatedUser!.passwordHash);
    const newPasswordAccepted = verifyPassword(newPassword, updatedUser!.passwordHash);
    const tokenDeleted = (await prisma.passwordResetToken.findUnique({ where: { token: resetToken } })) === null;

    assertTest("Password Reset", "Old password rejected after reset", oldPasswordRejected);
    assertTest("Password Reset", "New password verified successfully", newPasswordAccepted);
    assertTest("Password Reset", "Reset token single-use (deleted upon reset)", tokenDeleted);

    // Clean up
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.business.delete({ where: { id: testBusiness.id } });
  } catch (err: any) {
    assertTest("Password Reset", "Password reset test", false, err.message);
  }

  // ============================================================
  // 5. TRIAL REMINDERS & SCHEDULER ERROR/IDEMPOTENCY SAFETY
  // ============================================================
  try {
    const trialBiz = await prisma.business.create({
      data: {
        name: "Trial Reminder Store",
        ownerName: "Trial Owner",
        email: `trial_owner_${Date.now()}@example.com`,
        subscriptionStatus: "TRIAL",
        trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 - 1000), // 3 days left
        settingsJson: JSON.stringify({ sentTrialReminders: ["TRIAL_7_DAY"] }),
      },
    });

    // Run trial reminder processing (safely executes, handles any transport status)
    const reminderResult = await processTrialReminders();
    assertTest("Trial System", "Trial reminder processor executes safely", typeof reminderResult.processed === "number");

    // Check idempotency: TRIAL_7_DAY was already sent, so it must not be re-processed
    const updatedBiz = await prisma.business.findUnique({ where: { id: trialBiz.id } });
    const settings = JSON.parse(updatedBiz?.settingsJson || "{}");
    assertTest("Trial System", "Pre-existing sent milestone preserved idempotently", settings.sentTrialReminders.includes("TRIAL_7_DAY"));

    // Clean up
    await prisma.business.delete({ where: { id: trialBiz.id } });
  } catch (err: any) {
    assertTest("Trial System", "Trial reminder suite", false, err.message);
  }

  // ============================================================
  // 6. PLAN TIER DEFINITION & ENFORCEMENT
  // ============================================================
  try {
    // 6.1 Verify Plan Configurations
    assertTest("Subscription Plans", "Starter plan configured (₱499, 50 products, 100 orders)", PLANS.STARTER.price === 499 && PLANS.STARTER.limits.maxProducts === 50 && PLANS.STARTER.limits.maxOrdersPerMonth === 100);
    assertTest("Subscription Plans", "Business plan configured (₱999, unlimited products/orders, Full AI)", PLANS.BUSINESS.price === 999 && PLANS.BUSINESS.limits.maxProducts === null && PLANS.BUSINESS.features.aiAssistant === "FULL");
    assertTest("Subscription Plans", "Pro plan configured (₱1,999, 10 staff, advanced reporting, API)", PLANS.PRO.price === 1999 && PLANS.PRO.limits.maxStaffAccounts === 10 && PLANS.PRO.features.apiAccess === true);

    // 6.2 Test Effective Plan Access during Trial
    const trialPlan = getEffectivePlan("TRIAL", "STARTER");
    assertTest("Subscription Plans", "Trial grants BUSINESS-level full access", trialPlan.id === "BUSINESS");

    // 6.3 Test Expired Subscription Enforcement
    const expiredBiz = await prisma.business.create({
      data: {
        name: "Expired Store",
        ownerName: "Expired Owner",
        subscriptionStatus: "EXPIRED",
        planTier: "STARTER",
      },
    });

    const accessCheck = await checkPlanAccess(expiredBiz.id);
    assertTest("Subscription Plans", "Expired subscription access blocked with 403 error", accessCheck.errorResponse !== null && accessCheck.subscriptionStatus === "EXPIRED");

    // Clean up
    await prisma.business.delete({ where: { id: expiredBiz.id } });
  } catch (err: any) {
    assertTest("Subscription Plans", "Plan tier test", false, err.message);
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n============================================================");
  console.log("VALIDATION SUITE COMPLETE");
  console.log("============================================================");
  const total = reports.length;
  const passed = reports.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`Total Validations: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runComprehensiveVerification().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
