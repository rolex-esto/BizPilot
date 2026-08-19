import { prisma } from "../prisma";
import { hashPassword } from "./password";

export interface BootstrapResult {
  userId: string;
  email: string;
  name: string;
  role: string;
  isNew: boolean;
}

/**
 * Ensures a secure Administrator account exists in the database.
 * Reads credentials from environment variables ADMIN_EMAIL & ADMIN_PASSWORD.
 */
export async function bootstrapAdminAccount(): Promise<BootstrapResult> {
  const adminEmail = (
    process.env.BIZPILOT_ADMIN_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "bizpilot.mailer@gmail.com"
  ).toLowerCase().trim();
  const rawAdminPassword = process.env.BIZPILOT_ADMIN_INITIAL_PASSWORD || process.env.ADMIN_PASSWORD || "Admin2026!SecureBoot";
  const adminName = process.env.BIZPILOT_ADMIN_NAME || process.env.ADMIN_NAME || "BizPilot Administrator";

  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: adminEmail },
        { role: "ADMIN" },
      ],
    },
  });

  if (existingAdmin) {
    return {
      userId: existingAdmin.id,
      email: existingAdmin.email,
      name: existingAdmin.name,
      role: existingAdmin.role,
      isNew: false,
    };
  }

  const passwordHash = hashPassword(rawAdminPassword);

  const newAdmin = await prisma.user.create({
    data: {
      email: adminEmail,
      name: adminName,
      passwordHash,
      role: "ADMIN",
      businessId: null,
    },
  });

  return {
    userId: newAdmin.id,
    email: newAdmin.email,
    name: newAdmin.name,
    role: newAdmin.role,
    isNew: true,
  };
}
