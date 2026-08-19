import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/audit-logs
 * Returns separated audit logs (Admin Security Activity vs System Activity).
 * Owner private activity is kept separate and not mixed with administrative logs.
 */
export async function GET(req: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.toLowerCase().trim() || "";
    const type = url.searchParams.get("type"); // "ADMIN" | "SYSTEM" | "ALL"

    const where: any = {};

    if (type === "ADMIN") {
      where.performedBy = "ADMIN";
    } else if (type === "SYSTEM") {
      where.performedBy = { in: ["SYSTEM", "SYSTEM_AI", "WEBHOOK"] };
    } else {
      // By default in security logs, do not mix private OWNER activity with ADMIN security logs
      where.performedBy = { in: ["ADMIN", "SYSTEM", "SYSTEM_AI", "WEBHOOK"] };
    }

    if (search) {
      where.OR = [
        { action: { contains: search } },
        { details: { contains: search } },
        { business: { name: { contains: search } } },
      ];
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        business: {
          select: { id: true, name: true, ownerName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const adminLogs = logs.filter((l) => l.performedBy === "ADMIN");
    const systemLogs = logs.filter((l) => l.performedBy !== "ADMIN");

    return NextResponse.json({
      status: "success",
      logs,
      adminLogs,
      systemLogs,
    });
  } catch (error: any) {
    console.error("Admin list audit logs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
