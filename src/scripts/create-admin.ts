import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth/password";

/**
 * Idempotent Admin Account Provisioning Script
 * 
 * Usage:
 *   npx tsx src/scripts/create-admin.ts
 *   or
 *   npm run admin:create
 */
async function main() {
  const adminEmail = (
    process.env.BIZPILOT_ADMIN_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "bizpilot.mailer@gmail.com"
  ).toLowerCase().trim();

  const adminName = process.env.BIZPILOT_ADMIN_NAME || process.env.ADMIN_NAME || "BizPilot Administrator";

  console.log(`[ADMIN PROVISIONING] Checking administrator account: ${adminEmail}`);

  // 1. Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    // If user exists with role ADMIN
    if (existingAdmin.role === "ADMIN") {
      console.log(`[ADMIN PROVISIONING] BizPilot administrator already exists. (ID: ${existingAdmin.id}, Email: ${existingAdmin.email})`);
      return;
    }

    // If user exists but is not ADMIN, promote to ADMIN safely
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { role: "ADMIN", emailVerified: true },
    });
    console.log(`[ADMIN PROVISIONING] Updated existing user ${existingAdmin.email} to ADMIN role.`);
    return;
  }

  // 2. Generate or read secure password
  let rawPassword = process.env.BIZPILOT_ADMIN_INITIAL_PASSWORD || process.env.ADMIN_PASSWORD || "Admin2026!SecureBoot";

  const passwordHash = hashPassword(rawPassword);

  // 3. Create Admin User
  const newAdmin = await prisma.user.create({
    data: {
      email: adminEmail,
      name: adminName,
      passwordHash,
      role: "ADMIN",
      businessId: null, // Admin does not depend on a specific business record
      emailVerified: true,
    },
  });

  console.log(`[ADMIN PROVISIONING] Successfully provisioned BizPilot Administrator.`);
  console.log(`[ADMIN PROVISIONING] Account ID: ${newAdmin.id}`);
  console.log(`[ADMIN PROVISIONING] Email: ${newAdmin.email}`);
  console.log(`[ADMIN PROVISIONING] Role: ${newAdmin.role}`);
  console.log(`[ADMIN PROVISIONING] Status: VERIFIED & ACTIVE`);
}

main()
  .catch((err) => {
    console.error("[ADMIN PROVISIONING] Error:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
