import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendAdminApprovalOtpEmail } from "@/lib/email";

export type AdminApprovalAction =
  | "GRANT_ADMIN"
  | "REVOKE_ADMIN"
  | "GRANT_LIFETIME"
  | "REVOKE_LIFETIME"
  | "DELETE_USER"
  | "DELETE_BUSINESS"
  | "CHANGE_PLAN"
  | "EXTEND_TRIAL"
  | "RESET_TRIAL"
  | "SET_SUBSCRIPTION_STATUS";

/**
 * Generate a 6-digit cryptographically secure numeric OTP.
 */
export function generateSecureOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hash an OTP using SHA-256 with a unique cryptographic salt.
 */
export function hashOtp(otp: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(otp).digest("hex");
}

/**
 * Timing-safe OTP verification.
 */
export function verifyOtpHash(otp: string, expectedHash: string, salt: string): boolean {
  const computedHash = hashOtp(otp, salt);
  const bufA = Buffer.from(computedHash, "hex");
  const bufB = Buffer.from(expectedHash, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Helper to get human-readable action title for security emails and logs.
 */
export function getActionTitle(actionType: AdminApprovalAction): string {
  switch (actionType) {
    case "GRANT_ADMIN":
      return "Grant Administrator Access";
    case "REVOKE_ADMIN":
      return "Revoke Administrator Access";
    case "GRANT_LIFETIME":
      return "Grant Lifetime Access (PRO)";
    case "REVOKE_LIFETIME":
      return "Revoke Lifetime Access";
    case "DELETE_USER":
      return "Delete User Account";
    case "DELETE_BUSINESS":
      return "Delete Business & Store Data";
    case "CHANGE_PLAN":
      return "Change Subscription Plan";
    case "EXTEND_TRIAL":
      return "Extend Business Trial Period";
    case "RESET_TRIAL":
      return "Reset Business Trial Period";
    case "SET_SUBSCRIPTION_STATUS":
      return "Modify Subscription Status";
    default:
      return "Administrative Protected Action";
  }
}

/**
 * Initiates an Admin Approval Request, generates OTP, stores secure hash, and sends email.
 */
export async function createApprovalRequest({
  adminId,
  adminEmail,
  actionType,
  targetEmail,
  targetId,
  targetName,
  metadata,
}: {
  adminId: string;
  adminEmail: string;
  actionType: AdminApprovalAction;
  targetEmail: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, any>;
}) {
  const authorizedAdminEmail = process.env.BIZPILOT_ADMIN_EMAIL || "bizpilot.mailer@gmail.com";
  const now = new Date();

  // Check resend cooldown (60 seconds)
  const existingPending = await prisma.adminApprovalRequest.findFirst({
    where: {
      adminId,
      actionType,
      targetEmail: targetEmail.toLowerCase().trim(),
      status: "PENDING",
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingPending) {
    const elapsedSec = (now.getTime() - new Date(existingPending.lastSentAt).getTime()) / 1000;
    if (elapsedSec < 60) {
      const waitRemaining = Math.ceil(60 - elapsedSec);
      return {
        error: `Please wait ${waitRemaining} seconds before requesting a new approval code.`,
        cooldownRemaining: waitRemaining,
        requestId: existingPending.id,
      };
    }

    // Invalidate previous pending request when creating a new one
    await prisma.adminApprovalRequest.update({
      where: { id: existingPending.id },
      data: { status: "INVALIDATED" },
    });
  }

  // Generate new secure OTP
  const rawOtp = generateSecureOtp();
  const salt = crypto.randomBytes(16).toString("hex");
  const otpHash = hashOtp(rawOtp, salt);
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

  const request = await prisma.adminApprovalRequest.create({
    data: {
      adminId,
      actionType,
      targetEmail: targetEmail.toLowerCase().trim(),
      targetId,
      targetName,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
      otpHash,
      salt,
      attempts: 0,
      maxAttempts: 5,
      status: "PENDING",
      expiresAt,
      lastSentAt: now,
    },
  });

  const actionTitle = getActionTitle(actionType);
  let targetDesc = targetName ? `${targetName} (${targetEmail})` : targetEmail;
  if (actionType === "CHANGE_PLAN" && metadata) {
    targetDesc = `${targetName} (Current: ${metadata.currentPlan || "Starter"} → Requested: ${metadata.requestedPlan || "Pro"})`;
  } else if (actionType === "EXTEND_TRIAL" && metadata) {
    targetDesc = `${targetName} (+${metadata.extensionDays || 14} days trial extension)`;
  }

  // Send OTP email exclusively to authorized Administrator email
  await sendAdminApprovalOtpEmail(authorizedAdminEmail, actionTitle, targetDesc, rawOtp);

  // Record security audit event
  await prisma.auditLog.create({
    data: {
      businessId: targetId || null,
      action: `${actionType}_OTP_REQUESTED`,
      entityType: "AdminApprovalRequest",
      entityId: request.id,
      details: `Admin requested approval code for ${actionTitle} on ${targetEmail}. Sent to authorized admin email.`,
      performedBy: "ADMIN",
    },
  });

  return {
    success: true,
    requestId: request.id,
    actionType: request.actionType,
    targetEmail: request.targetEmail,
    targetName: request.targetName,
    metadata: metadata || null,
    expiresAt: request.expiresAt,
    authorizedAdminEmail: authorizedAdminEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3"), // Masked for UI display
  };
}

/**
 * Validates the 6-digit OTP code against the stored hash.
 */
export async function verifyApprovalOtp({
  requestId,
  adminId,
  otp,
}: {
  requestId: string;
  adminId: string;
  otp: string;
}) {
  const now = new Date();
  const cleanOtp = otp.trim();

  const request = await prisma.adminApprovalRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    return { error: "Approval request not found. Please start over.", code: "NOT_FOUND" };
  }

  if (request.adminId !== adminId) {
    return { error: "Unauthorized: Request does not belong to your session.", code: "UNAUTHORIZED" };
  }

  if (request.status === "CONSUMED") {
    return { error: "This approval code has already been used.", code: "ALREADY_USED" };
  }

  if (request.status === "INVALIDATED") {
    return { error: "This approval request has been invalidated due to too many failed attempts.", code: "INVALIDATED" };
  }

  if (request.expiresAt < now || request.status === "EXPIRED") {
    await prisma.adminApprovalRequest.update({
      where: { id: requestId },
      data: { status: "EXPIRED" },
    });
    return { error: "This approval code has expired. Please request a new one.", code: "EXPIRED" };
  }

  if (request.attempts >= request.maxAttempts) {
    await prisma.adminApprovalRequest.update({
      where: { id: requestId },
      data: { status: "INVALIDATED" },
    });
    return { error: "Maximum verification attempts exceeded. This request has been invalidated.", code: "MAX_ATTEMPTS_EXCEEDED" };
  }

  const isValid = verifyOtpHash(cleanOtp, request.otpHash, request.salt);

  if (!isValid) {
    const updatedAttempts = request.attempts + 1;
    const isNowInvalidated = updatedAttempts >= request.maxAttempts;

    await prisma.adminApprovalRequest.update({
      where: { id: requestId },
      data: {
        attempts: updatedAttempts,
        status: isNowInvalidated ? "INVALIDATED" : "PENDING",
      },
    });

    const attemptsRemaining = Math.max(0, request.maxAttempts - updatedAttempts);
    return {
      error: isNowInvalidated
        ? "Invalid approval code. Maximum attempts exceeded — request invalidated."
        : `Invalid approval code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining.`,
      code: "INVALID_OTP",
      attemptsRemaining,
    };
  }

  // OTP is valid! Advance to VERIFIED state
  const verified = await prisma.adminApprovalRequest.update({
    where: { id: requestId },
    data: {
      status: "VERIFIED",
      verifiedAt: now,
    },
  });

  let meta: any = null;
  if (verified.metadataJson) {
    try {
      meta = JSON.parse(verified.metadataJson);
    } catch {}
  }

  return {
    success: true,
    requestId: verified.id,
    actionType: verified.actionType,
    targetEmail: verified.targetEmail,
    targetName: verified.targetName,
    targetId: verified.targetId,
    metadata: meta,
  };
}

/**
 * Executes the verified approval action and atomically consumes the request.
 */
export async function executeApprovalAction({
  requestId,
  adminId,
  adminEmail,
}: {
  requestId: string;
  adminId: string;
  adminEmail: string;
}) {
  const now = new Date();

  const request = await prisma.adminApprovalRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    return { error: "Approval request not found.", code: "NOT_FOUND" };
  }

  if (request.adminId !== adminId) {
    return { error: "Unauthorized session binding.", code: "UNAUTHORIZED" };
  }

  if (request.status !== "VERIFIED") {
    return { error: "Approval code has not been verified yet.", code: "NOT_VERIFIED" };
  }

  if (request.expiresAt < now) {
    return { error: "Approval request has expired.", code: "EXPIRED" };
  }

  let metadata: Record<string, any> = {};
  if (request.metadataJson) {
    try {
      metadata = JSON.parse(request.metadataJson);
    } catch {}
  }

  // 1. GRANT_ADMIN
  if (request.actionType === "GRANT_ADMIN") {
    const targetUser = await prisma.user.findUnique({
      where: { email: request.targetEmail },
    });

    if (!targetUser) {
      return { error: `User account "${request.targetEmail}" no longer exists.`, code: "TARGET_NOT_FOUND" };
    }

    const previousRole = targetUser.role;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUser.id },
        data: { role: "ADMIN" },
      });

      await tx.adminApprovalRequest.update({
        where: { id: requestId },
        data: { status: "CONSUMED", consumedAt: now },
      });

      await tx.auditLog.create({
        data: {
          businessId: targetUser.businessId || null,
          action: "ADMIN_ROLE_GRANTED",
          entityType: "User",
          entityId: targetUser.id,
          details: `Admin ${adminEmail} granted Administrator access to ${targetUser.name} (${targetUser.email}). Role changed from ${previousRole} to ADMIN.`,
          performedBy: "ADMIN",
        },
      });
    });

    return {
      success: true,
      message: `Administrator access granted to ${targetUser.name} (${targetUser.email}).`,
      actionType: "GRANT_ADMIN",
      targetEmail: targetUser.email,
    };
  }

  // 2. REVOKE_ADMIN
  if (request.actionType === "REVOKE_ADMIN") {
    const targetUser = await prisma.user.findUnique({
      where: { email: request.targetEmail },
    });

    if (!targetUser) {
      return { error: `User account "${request.targetEmail}" no longer exists.`, code: "TARGET_NOT_FOUND" };
    }

    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return {
        error: "Cannot revoke Administrator access from the last remaining admin account.",
        code: "LAST_ADMIN_PROTECTED",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUser.id },
        data: { role: "OWNER" },
      });

      await tx.adminApprovalRequest.update({
        where: { id: requestId },
        data: { status: "CONSUMED", consumedAt: now },
      });

      await tx.auditLog.create({
        data: {
          businessId: targetUser.businessId || null,
          action: "ADMIN_ROLE_REVOKED",
          entityType: "User",
          entityId: targetUser.id,
          details: `Admin ${adminEmail} revoked Administrator role from ${targetUser.name} (${targetUser.email}). Role changed to OWNER.`,
          performedBy: "ADMIN",
        },
      });
    });

    return {
      success: true,
      message: `Administrator access revoked from ${targetUser.name}.`,
      actionType: "REVOKE_ADMIN",
      targetEmail: targetUser.email,
    };
  }

  // Helper to resolve business by ID, Business Email, or User Login Email
  const resolveBusiness = async () => {
    if (request.targetId) {
      const b = await prisma.business.findUnique({ where: { id: request.targetId } });
      if (b) return b;
    }
    if (request.targetEmail) {
      const clean = request.targetEmail.toLowerCase().trim();
      const b = await prisma.business.findFirst({ where: { email: clean } });
      if (b) return b;
      const u = await prisma.user.findUnique({ where: { email: clean } });
      if (u?.businessId) {
        return await prisma.business.findUnique({ where: { id: u.businessId } });
      }
    }
    return null;
  };

  // 3. GRANT_LIFETIME
  if (request.actionType === "GRANT_LIFETIME") {
    const targetBiz = await resolveBusiness();

    if (!targetBiz) {
      return { error: `Business with email "${request.targetEmail}" no longer exists.`, code: "TARGET_NOT_FOUND" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: targetBiz.id },
        data: {
          isLifetimeFree: true,
          subscriptionStatus: "LIFETIME",
          planTier: "PRO",
          trialEndsAt: null,
        },
      });

      // Restore any suspended channels
      await tx.platformConnection.updateMany({
        where: { businessId: targetBiz.id, status: "SUSPENDED_BY_PLAN" },
        data: { status: "CONNECTED", statusMessage: null },
      });

      await tx.adminApprovalRequest.update({
        where: { id: requestId },
        data: { status: "CONSUMED", consumedAt: now },
      });

      await tx.auditLog.create({
        data: {
          businessId: targetBiz.id,
          action: "LIFETIME_ACCESS_GRANTED",
          entityType: "Business",
          entityId: targetBiz.id,
          details: `Admin ${adminEmail} granted Lifetime Access (PRO) to store "${targetBiz.name}" (Owner: ${targetBiz.ownerName}). Subscription renewals no longer required.`,
          performedBy: "ADMIN",
        },
      });
    });

    return {
      success: true,
      message: `Lifetime Access (PRO) granted to "${targetBiz.name}".`,
      actionType: "GRANT_LIFETIME",
      targetName: targetBiz.name,
      targetEmail: targetBiz.email,
    };
  }

  // 4. REVOKE_LIFETIME
  if (request.actionType === "REVOKE_LIFETIME") {
    const targetBiz = await resolveBusiness();

    if (!targetBiz) {
      return { error: `Business "${request.targetEmail}" no longer exists.`, code: "TARGET_NOT_FOUND" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: targetBiz.id },
        data: {
          isLifetimeFree: false,
          subscriptionStatus: "ACTIVE",
          planTier: "STARTER",
        },
      });

      await tx.adminApprovalRequest.update({
        where: { id: requestId },
        data: { status: "CONSUMED", consumedAt: now },
      });

      await tx.auditLog.create({
        data: {
          businessId: targetBiz.id,
          action: "LIFETIME_ACCESS_REVOKED",
          entityType: "Business",
          entityId: targetBiz.id,
          details: `Admin ${adminEmail} revoked Lifetime Access from store "${targetBiz.name}". Plan reset to Standard Starter.`,
          performedBy: "ADMIN",
        },
      });
    });

    return {
      success: true,
      message: `Lifetime Access revoked from "${targetBiz.name}".`,
      actionType: "REVOKE_LIFETIME",
      targetName: targetBiz.name,
    };
  }

  // 5. CHANGE_PLAN (Starter / Business / Pro, Active / Trial)
  if (request.actionType === "CHANGE_PLAN") {
    const targetBiz = await resolveBusiness();

    if (!targetBiz) {
      return { error: `Business "${request.targetEmail}" no longer exists.`, code: "TARGET_NOT_FOUND" };
    }

    const previousPlan = targetBiz.planTier;
    const previousStatus = targetBiz.subscriptionStatus;
    const requestedPlan = metadata.requestedPlan || "STARTER";
    const requestedStatus = metadata.requestedStatus || (targetBiz.subscriptionStatus === "TRIAL" ? "TRIAL" : "ACTIVE");

    await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: targetBiz.id },
        data: {
          planTier: requestedPlan,
          subscriptionStatus: requestedStatus,
          isLifetimeFree: false,
        },
      });

      await tx.adminApprovalRequest.update({
        where: { id: requestId },
        data: { status: "CONSUMED", consumedAt: now },
      });

      await tx.auditLog.create({
        data: {
          businessId: targetBiz.id,
          action: "SUBSCRIPTION_UPDATED",
          entityType: "Business",
          entityId: targetBiz.id,
          details: `Admin ${adminEmail} changed ${targetBiz.name}'s plan from ${previousPlan} (${previousStatus}) to ${requestedPlan} (${requestedStatus}).`,
          performedBy: "ADMIN",
        },
      });
    });

    return {
      success: true,
      message: `${targetBiz.name} is now using the ${requestedPlan} plan (${requestedStatus}).`,
      actionType: "CHANGE_PLAN",
      targetName: targetBiz.name,
      previousPlan,
      newPlan: requestedPlan,
      newStatus: requestedStatus,
    };
  }

  // 6. EXTEND_TRIAL
  if (request.actionType === "EXTEND_TRIAL") {
    const targetBiz = await resolveBusiness();

    if (!targetBiz) {
      return { error: `Business "${request.targetEmail}" no longer exists.`, code: "TARGET_NOT_FOUND" };
    }

    const extensionDays = Number(metadata.extensionDays) || 14;
    const baseDate = targetBiz.trialEndsAt && targetBiz.trialEndsAt > now ? targetBiz.trialEndsAt : now;
    const newTrialEndsAt = new Date(baseDate.getTime() + extensionDays * 24 * 3600 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: targetBiz.id },
        data: {
          trialEndsAt: newTrialEndsAt,
          subscriptionStatus: "TRIAL",
        },
      });

      await tx.adminApprovalRequest.update({
        where: { id: requestId },
        data: { status: "CONSUMED", consumedAt: now },
      });

      await tx.auditLog.create({
        data: {
          businessId: targetBiz.id,
          action: "TRIAL_EXTENDED",
          entityType: "Business",
          entityId: targetBiz.id,
          details: `Admin ${adminEmail} extended trial for ${targetBiz.name} by ${extensionDays} days until ${newTrialEndsAt.toLocaleDateString()}.`,
          performedBy: "ADMIN",
        },
      });
    });

    return {
      success: true,
      message: `Extended ${targetBiz.name}'s trial by ${extensionDays} days.`,
      actionType: "EXTEND_TRIAL",
      targetName: targetBiz.name,
    };
  }

  // 7. RESET_TRIAL
  if (request.actionType === "RESET_TRIAL") {
    const targetBiz = await resolveBusiness();

    if (!targetBiz) {
      return { error: `Business "${request.targetEmail}" no longer exists.`, code: "TARGET_NOT_FOUND" };
    }

    const newTrialEndsAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000); // 30-day fresh trial

    await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: targetBiz.id },
        data: {
          trialEndsAt: newTrialEndsAt,
          subscriptionStatus: "TRIAL",
        },
      });

      await tx.adminApprovalRequest.update({
        where: { id: requestId },
        data: { status: "CONSUMED", consumedAt: now },
      });

      await tx.auditLog.create({
        data: {
          businessId: targetBiz.id,
          action: "TRIAL_RESET",
          entityType: "Business",
          entityId: targetBiz.id,
          details: `Admin ${adminEmail} reset trial period for ${targetBiz.name} to fresh 30 days until ${newTrialEndsAt.toLocaleDateString()}.`,
          performedBy: "ADMIN",
        },
      });
    });

    return {
      success: true,
      message: `Reset ${targetBiz.name}'s trial to a fresh 30-day period.`,
      actionType: "RESET_TRIAL",
      targetName: targetBiz.name,
    };
  }

  // 8. SET_SUBSCRIPTION_STATUS (e.g. Suspend / Restore / Expired / Active)
  if (request.actionType === "SET_SUBSCRIPTION_STATUS") {
    const targetBiz = await resolveBusiness();

    if (!targetBiz) {
      return { error: `Business "${request.targetEmail}" no longer exists.`, code: "TARGET_NOT_FOUND" };
    }

    const requestedStatus = metadata.requestedStatus || "ACTIVE";
    const previousStatus = targetBiz.subscriptionStatus;

    await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: targetBiz.id },
        data: {
          subscriptionStatus: requestedStatus,
        },
      });

      await tx.adminApprovalRequest.update({
        where: { id: requestId },
        data: { status: "CONSUMED", consumedAt: now },
      });

      await tx.auditLog.create({
        data: {
          businessId: targetBiz.id,
          action: "SUBSCRIPTION_STATUS_UPDATED",
          entityType: "Business",
          entityId: targetBiz.id,
          details: `Admin ${adminEmail} changed ${targetBiz.name}'s subscription status from ${previousStatus} to ${requestedStatus}.`,
          performedBy: "ADMIN",
        },
      });
    });

    return {
      success: true,
      message: `${targetBiz.name} status updated to ${requestedStatus}.`,
      actionType: "SET_SUBSCRIPTION_STATUS",
      targetName: targetBiz.name,
    };
  }

  // 9. DELETE_USER
  if (request.actionType === "DELETE_USER") {
    const targetUser = await prisma.user.findUnique({
      where: { email: request.targetEmail },
    });

    if (!targetUser) {
      return { error: `User account "${request.targetEmail}" no longer exists.`, code: "TARGET_NOT_FOUND" };
    }

    if (targetUser.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return {
          error: "Cannot delete the last remaining administrator account.",
          code: "LAST_ADMIN_PROTECTED",
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId: targetUser.id } });
      await tx.user.delete({ where: { id: targetUser.id } });

      await tx.adminApprovalRequest.update({
        where: { id: requestId },
        data: { status: "CONSUMED", consumedAt: now },
      });

      await tx.auditLog.create({
        data: {
          businessId: targetUser.businessId || null,
          action: "USER_DELETED",
          entityType: "User",
          entityId: targetUser.id,
          details: `Admin ${adminEmail} deleted user account ${targetUser.name} (${targetUser.email}).`,
          performedBy: "ADMIN",
        },
      });
    });

    return {
      success: true,
      message: `User "${targetUser.name}" has been deleted.`,
      actionType: "DELETE_USER",
    };
  }

  // 10. DELETE_BUSINESS
  if (request.actionType === "DELETE_BUSINESS") {
    const targetBiz = await resolveBusiness();

    if (!targetBiz) {
      return { error: `Business "${request.targetEmail}" no longer exists.`, code: "TARGET_NOT_FOUND" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.adminApprovalRequest.update({
        where: { id: requestId },
        data: { status: "CONSUMED", consumedAt: now },
      });

      await tx.auditLog.create({
        data: {
          businessId: null,
          action: "BUSINESS_DELETED",
          entityType: "Business",
          entityId: targetBiz.id,
          details: `Admin ${adminEmail} deleted business "${targetBiz.name}" (Owner: ${targetBiz.ownerName}).`,
          performedBy: "ADMIN",
        },
      });

      await tx.business.delete({ where: { id: targetBiz.id } });
    });

    return {
      success: true,
      message: `Business "${targetBiz.name}" has been deleted.`,
      actionType: "DELETE_BUSINESS",
    };
  }

  return { error: "Unknown action type.", code: "INVALID_ACTION" };
}
