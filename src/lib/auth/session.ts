import { prisma } from "../prisma";
import crypto from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "bizpilot_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "OWNER";
  businessId: string | null;
}

/**
 * Creates a server-side session in the database for the given user ID.
 */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/**
 * Validates a session token against the database, removing expired sessions automatically.
 */
export async function validateSessionToken(token: string): Promise<AuthenticatedUser | null> {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role as "ADMIN" | "OWNER",
    businessId: session.user.businessId,
  };
}

/**
 * Invalidates (deletes) a session token from the database.
 */
export async function invalidateSession(token: string): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({
    where: { token },
  }).catch(() => {});
}

/**
 * Retrieves the current authenticated user from Next.js server cookies.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await validateSessionToken(token);
  } catch {
    return null;
  }
}
