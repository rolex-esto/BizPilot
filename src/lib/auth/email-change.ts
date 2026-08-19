import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  sendCurrentEmailChangeOtpEmail,
  sendNewEmailVerificationOtpEmail,
} from "@/lib/email";

export const OTP_EXPIRY_MINUTES = 10;
export const MAX_OTP_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Mask an email address for privacy-safe UI display (e.g. r***@example.com).
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Generate a 6-digit numeric OTP.
 */
export function generateSecureOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hash an OTP using SHA-256 with a unique salt.
 */
export function hashOtp(otp: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(otp.trim()).digest("hex");
}

/**
 * Timing-safe comparison of OTP hashes.
 */
export function verifyOtpHash(otp: string, expectedHash: string, salt: string): boolean {
  const computed = hashOtp(otp, salt);
  const bufA = Buffer.from(computed, "hex");
  const bufB = Buffer.from(expectedHash, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * STEP 1: Request verification for the user's CURRENT email address.
 * Strictly uses the server-authenticated user record.
 */
export async function requestCurrentEmailVerification({
  userId,
}: {
  userId: string;
}) {
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, businessId: true },
  });

  if (!user) {
    return { error: "Authenticated user not found.", code: "USER_NOT_FOUND" };
  }

  // Check resend cooldown on recent pending requests
  const existingPending = await prisma.emailChangeRequest.findFirst({
    where: {
      userId,
      status: "PENDING_CURRENT",
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingPending) {
    const elapsedSec = (now.getTime() - new Date(existingPending.lastSentAt).getTime()) / 1000;
    if (elapsedSec < RESEND_COOLDOWN_SECONDS) {
      const waitRemaining = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSec);
      return {
        error: `Please wait ${waitRemaining} seconds before requesting a new verification code.`,
        cooldownRemaining: waitRemaining,
        requestId: existingPending.id,
        maskedCurrentEmail: maskEmail(user.email),
      };
    }

    // Invalidate prior request
    await prisma.emailChangeRequest.update({
      where: { id: existingPending.id },
      data: { status: "INVALIDATED" },
    });
  }

  // Generate OTP and store hash with salt
  const rawOtp = generateSecureOtp();
  const salt = crypto.randomBytes(16).toString("hex");
  const otpHash = hashOtp(rawOtp, salt);
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const request = await prisma.emailChangeRequest.create({
    data: {
      userId: user.id,
      currentEmail: user.email.toLowerCase().trim(),
      currentOtpHash: otpHash,
      currentOtpSalt: salt,
      currentAttempts: 0,
      maxAttempts: MAX_OTP_ATTEMPTS,
      status: "PENDING_CURRENT",
      expiresAt,
      lastSentAt: now,
    },
  });

  // Send email to current email
  await sendCurrentEmailChangeOtpEmail(user.email, user.name, rawOtp);

  // Record audit log
  await prisma.auditLog.create({
    data: {
      businessId: user.businessId || null,
      action: "EMAIL_CHANGE_CURRENT_OTP_REQUESTED",
      entityType: "EmailChangeRequest",
      entityId: request.id,
      details: `User ${user.name} requested verification code to change email. Code sent to ${maskEmail(user.email)}.`,
      performedBy: "OWNER",
    },
  });

  return {
    success: true,
    requestId: request.id,
    maskedCurrentEmail: maskEmail(user.email),
    expiresAt: request.expiresAt,
    cooldownRemaining: RESEND_COOLDOWN_SECONDS,
  };
}

/**
 * STEP 2: Verify the 6-digit OTP sent to the user's CURRENT email.
 */
export async function verifyCurrentEmailOtp({
  requestId,
  userId,
  otp,
}: {
  requestId: string;
  userId: string;
  otp: string;
}) {
  const now = new Date();
  const cleanOtp = otp.trim();

  const request = await prisma.emailChangeRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    return { error: "Verification request not found. Please start over.", code: "NOT_FOUND" };
  }

  if (request.userId !== userId) {
    return { error: "Unauthorized session binding.", code: "UNAUTHORIZED" };
  }

  if (request.status === "CURRENT_VERIFIED" || request.status === "PENDING_NEW" || request.status === "COMPLETED") {
    return { success: true, requestId: request.id, alreadyVerified: true };
  }

  if (request.status === "INVALIDATED") {
    return { error: "This verification request has been invalidated. Please request a new code.", code: "INVALIDATED" };
  }

  if (request.expiresAt < now || request.status === "EXPIRED") {
    await prisma.emailChangeRequest.update({
      where: { id: requestId },
      data: { status: "EXPIRED" },
    });
    return { error: "Verification code has expired. Please request a new one.", code: "EXPIRED" };
  }

  if (request.currentAttempts >= request.maxAttempts) {
    await prisma.emailChangeRequest.update({
      where: { id: requestId },
      data: { status: "INVALIDATED" },
    });
    return { error: "Maximum verification attempts exceeded. Request invalidated for security.", code: "MAX_ATTEMPTS_EXCEEDED" };
  }

  if (!request.currentOtpHash || !request.currentOtpSalt) {
    return { error: "Security state error. Please request a new code.", code: "INVALID_STATE" };
  }

  const isValid = verifyOtpHash(cleanOtp, request.currentOtpHash, request.currentOtpSalt);

  if (!isValid) {
    const updatedAttempts = request.currentAttempts + 1;
    const isNowInvalidated = updatedAttempts >= request.maxAttempts;

    await prisma.emailChangeRequest.update({
      where: { id: requestId },
      data: {
        currentAttempts: updatedAttempts,
        status: isNowInvalidated ? "INVALIDATED" : "PENDING_CURRENT",
      },
    });

    const attemptsRemaining = Math.max(0, request.maxAttempts - updatedAttempts);
    return {
      error: isNowInvalidated
        ? "Incorrect verification code. Maximum attempts exceeded — request invalidated."
        : `Incorrect verification code. You have ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining.`,
      code: "INVALID_OTP",
      attemptsRemaining,
    };
  }

  // Mark CURRENT email as verified
  const verified = await prisma.emailChangeRequest.update({
    where: { id: requestId },
    data: {
      status: "CURRENT_VERIFIED",
      currentEmailVerifiedAt: now,
    },
  });

  return {
    success: true,
    requestId: verified.id,
    currentEmailVerified: true,
  };
}

/**
 * STEP 3: Submit NEW email address and dispatch verification OTP to it.
 * Requires that current email has already been verified in this request.
 */
export async function requestNewEmailVerification({
  requestId,
  userId,
  newEmail,
}: {
  requestId: string;
  userId: string;
  newEmail: string;
}) {
  const now = new Date();

  if (!newEmail || typeof newEmail !== "string" || !newEmail.includes("@")) {
    return { error: "Please enter a valid email address.", code: "INVALID_FORMAT" };
  }

  const cleanEmail = newEmail.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return { error: "Please enter a valid email address format.", code: "INVALID_FORMAT" };
  }

  const request = await prisma.emailChangeRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    return { error: "Verification request not found. Please start over.", code: "NOT_FOUND" };
  }

  if (request.userId !== userId) {
    return { error: "Unauthorized session binding.", code: "UNAUTHORIZED" };
  }

  if (!request.currentEmailVerifiedAt || (request.status !== "CURRENT_VERIFIED" && request.status !== "PENDING_NEW")) {
    return { error: "You must verify your current email address first.", code: "CURRENT_NOT_VERIFIED" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, businessId: true },
  });

  if (!user) {
    return { error: "User account not found.", code: "USER_NOT_FOUND" };
  }

  if (cleanEmail === user.email.toLowerCase().trim()) {
    return { error: "Your new email address must be different from your current email address.", code: "SAME_EMAIL" };
  }

  // Check if new email is already taken by another account (case-insensitive)
  const existingUser = await prisma.user.findUnique({
    where: { email: cleanEmail },
  });

  if (existingUser && existingUser.id !== userId) {
    return { error: "This email address is already in use by another account.", code: "EMAIL_TAKEN" };
  }

  // Check resend cooldown
  if (request.status === "PENDING_NEW" && request.newEmail === cleanEmail) {
    const elapsedSec = (now.getTime() - new Date(request.lastSentAt).getTime()) / 1000;
    if (elapsedSec < RESEND_COOLDOWN_SECONDS) {
      const waitRemaining = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSec);
      return {
        error: `Please wait ${waitRemaining} seconds before requesting a new code.`,
        cooldownRemaining: waitRemaining,
        requestId: request.id,
        maskedNewEmail: maskEmail(cleanEmail),
      };
    }
  }

  // Generate new OTP for the new email
  const rawOtp = generateSecureOtp();
  const salt = crypto.randomBytes(16).toString("hex");
  const otpHash = hashOtp(rawOtp, salt);
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const updatedRequest = await prisma.emailChangeRequest.update({
    where: { id: requestId },
    data: {
      newEmail: cleanEmail,
      newOtpHash: otpHash,
      newOtpSalt: salt,
      newAttempts: 0,
      status: "PENDING_NEW",
      expiresAt,
      lastSentAt: now,
    },
  });

  // Send OTP to NEW email
  await sendNewEmailVerificationOtpEmail(cleanEmail, user.name, rawOtp);

  // Record audit log
  await prisma.auditLog.create({
    data: {
      businessId: user.businessId || null,
      action: "EMAIL_CHANGE_NEW_OTP_REQUESTED",
      entityType: "EmailChangeRequest",
      entityId: request.id,
      details: `User ${user.name} submitted new email ${maskEmail(cleanEmail)}. Verification code dispatched to new address.`,
      performedBy: "OWNER",
    },
  });

  return {
    success: true,
    requestId: updatedRequest.id,
    newEmail: cleanEmail,
    maskedNewEmail: maskEmail(cleanEmail),
    expiresAt: updatedRequest.expiresAt,
    cooldownRemaining: RESEND_COOLDOWN_SECONDS,
  };
}

/**
 * STEP 4: Verify the 6-digit OTP sent to the NEW email address and finalize the email update.
 * Atomically updates User.email, User.emailVerified, Business.email and cleans up pending tokens.
 */
export async function verifyNewEmailOtp({
  requestId,
  userId,
  otp,
}: {
  requestId: string;
  userId: string;
  otp: string;
}) {
  const now = new Date();
  const cleanOtp = otp.trim();

  const request = await prisma.emailChangeRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    return { error: "Verification request not found. Please start over.", code: "NOT_FOUND" };
  }

  if (request.userId !== userId) {
    return { error: "Unauthorized session binding.", code: "UNAUTHORIZED" };
  }

  if (request.status !== "PENDING_NEW" || !request.newEmail) {
    return { error: "Invalid verification state. Please request a new verification code.", code: "INVALID_STATE" };
  }

  if (request.expiresAt < now) {
    await prisma.emailChangeRequest.update({
      where: { id: requestId },
      data: { status: "EXPIRED" },
    });
    return { error: "Verification code has expired. Please request a new one.", code: "EXPIRED" };
  }

  if (request.newAttempts >= request.maxAttempts) {
    await prisma.emailChangeRequest.update({
      where: { id: requestId },
      data: { status: "INVALIDATED" },
    });
    return { error: "Maximum verification attempts exceeded. Request invalidated for security.", code: "MAX_ATTEMPTS_EXCEEDED" };
  }

  if (!request.newOtpHash || !request.newOtpSalt) {
    return { error: "Security state error. Please request a new code.", code: "INVALID_STATE" };
  }

  const isValid = verifyOtpHash(cleanOtp, request.newOtpHash, request.newOtpSalt);

  if (!isValid) {
    const updatedAttempts = request.newAttempts + 1;
    const isNowInvalidated = updatedAttempts >= request.maxAttempts;

    await prisma.emailChangeRequest.update({
      where: { id: requestId },
      data: {
        newAttempts: updatedAttempts,
        status: isNowInvalidated ? "INVALIDATED" : "PENDING_NEW",
      },
    });

    const attemptsRemaining = Math.max(0, request.maxAttempts - updatedAttempts);
    return {
      error: isNowInvalidated
        ? "Incorrect verification code. Maximum attempts exceeded — request invalidated."
        : `Incorrect verification code. You have ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining.`,
      code: "INVALID_OTP",
      attemptsRemaining,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, businessId: true },
  });

  if (!user) {
    return { error: "User account not found.", code: "USER_NOT_FOUND" };
  }

  const newEmail = request.newEmail.toLowerCase().trim();
  const previousEmail = user.email;

  // Final check if email was taken while waiting for verification
  const existingUser = await prisma.user.findUnique({
    where: { email: newEmail },
  });

  if (existingUser && existingUser.id !== userId) {
    return { error: "This email address was recently registered by another account.", code: "EMAIL_TAKEN" };
  }

  // ATOMIC DATABASE UPDATE & CONSUMPTION
  await prisma.$transaction(async (tx) => {
    // 1. Update User email and mark verified
    await tx.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        emailVerified: true,
      },
    });

    // 2. Update Business email if associated
    if (user.businessId) {
      await tx.business.update({
        where: { id: user.businessId },
        data: { email: newEmail },
      });
    }

    // 3. Mark this request COMPLETED
    await tx.emailChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "COMPLETED",
        newEmailVerifiedAt: now,
      },
    });

    // 4. Invalidate all other pending requests for this user
    await tx.emailChangeRequest.updateMany({
      where: {
        userId,
        id: { not: requestId },
        status: { in: ["PENDING_CURRENT", "CURRENT_VERIFIED", "PENDING_NEW"] },
      },
      data: { status: "INVALIDATED" },
    });

    // 5. Create immutable audit log
    await tx.auditLog.create({
      data: {
        businessId: user.businessId || null,
        action: "ACCOUNT_EMAIL_CHANGED",
        entityType: "User",
        entityId: user.id,
        details: `User ${user.name} successfully changed login email from ${previousEmail} to ${newEmail} after 2-step verification.`,
        performedBy: "OWNER",
      },
    });
  });

  return {
    success: true,
    newEmail,
    previousEmail,
    message: "Your login email address has been successfully updated.",
  };
}
