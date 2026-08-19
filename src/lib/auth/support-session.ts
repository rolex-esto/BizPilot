import { prisma } from "../prisma";

/**
 * Privacy Masking Helpers
 */
export function maskName(name?: string | null): string {
  if (!name) return "Anonymous";
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed + "***";
  const parts = trimmed.split(" ");
  if (parts.length === 1) {
    return trimmed.slice(0, 2) + "*".repeat(Math.max(3, trimmed.length - 2));
  }
  const first = parts[0];
  const last = parts.slice(1).join(" ");
  return `${first} ${last.charAt(0)}${"*".repeat(Math.max(3, last.length - 1))}`;
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return "Not provided";
  const cleaned = phone.replace(/[^0-9+]/g, "");
  if (cleaned.length <= 4) return "09**********";
  return cleaned.slice(0, 4) + "*".repeat(Math.max(4, cleaned.length - 4));
}

export function maskEmail(email?: string | null): string {
  if (!email) return "Not provided";
  const parts = email.split("@");
  if (parts.length !== 2) return "m*****@******.com";
  const [local, domain] = parts;
  const maskedLocal = local.length <= 2 ? local + "***" : local.slice(0, 1) + "*****";
  const domainParts = domain.split(".");
  const maskedDomain = domainParts.length > 1 
    ? "******." + domainParts[domainParts.length - 1]
    : "******.com";
  return `${maskedLocal}@${maskedDomain}`;
}

export function maskAddress(address?: string | null): string {
  if (!address) return "Not provided";
  return "Hidden (Owner Privacy Protected)";
}

/**
 * Verifies if an administrator has an active, valid Support Access session for a business.
 * Automatically marks expired sessions as EXPIRED in the database.
 */
export async function getActiveSupportSession(adminId: string, businessId: string) {
  const now = new Date();

  // Expire any outdated sessions in database
  await prisma.supportSession.updateMany({
    where: {
      adminId,
      businessId,
      status: "ACTIVE",
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });

  // Find valid unexpired active session
  const session = await prisma.supportSession.findFirst({
    where: {
      adminId,
      businessId,
      status: "ACTIVE",
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  return session;
}
