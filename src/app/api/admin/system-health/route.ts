import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/system-health
 * Returns high-level system health metrics.
 * Secret keys, SMTP passwords, and tokens are NEVER exposed.
 */
export async function GET(req: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startTime;

    const smtpConfigured = Boolean(process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD);
    const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);

    const [userCount, bizCount, orderCount] = await Promise.all([
      prisma.user.count(),
      prisma.business.count(),
      prisma.order.count(),
    ]);

    return NextResponse.json({
      status: "success",
      health: {
        application: "HEALTHY",
        database: {
          status: "HEALTHY",
          latencyMs: dbLatencyMs,
          type: "SQLite / Prisma ORM",
        },
        services: {
          smtpEmail: smtpConfigured ? "Configured (Gmail SMTP)" : "Not Configured",
          geminiAi: geminiConfigured ? "Configured (Gemini 2.5 Flash)" : "Not Configured",
        },
        metrics: {
          totalUsers: userCount,
          totalBusinesses: bizCount,
          totalOrders: orderCount,
          nodeVersion: process.version,
          uptimeSeconds: Math.floor(process.uptime()),
        },
        environment: process.env.NODE_ENV || "development",
      },
    });
  } catch (error: any) {
    console.error("Admin system health error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
