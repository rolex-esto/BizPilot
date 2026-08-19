import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const searchParams = req.nextUrl.searchParams;
    const platform = searchParams.get("platform");
    const leadStatus = searchParams.get("leadStatus");
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const envParam = searchParams.get("environment") || searchParams.get("mode");
    const environment = envParam?.toUpperCase() === "PRACTICE" ? "PRACTICE" : "LIVE";

    // Privacy Guard: If user has no businessId (e.g. system admin), conversations are private to store owners
    if (!user?.businessId) {
      return NextResponse.json({
        status: "success",
        conversations: [],
        message: "Conversations are private to store owners.",
      });
    }

    const where: any = {
      businessId: user.businessId,
      environment,
    };

    if (platform && platform !== "ALL") {
      where.platform = platform;
    }
    if (unreadOnly) {
      where.unreadCount = { gt: 0 };
    }
    if (leadStatus && leadStatus !== "ALL") {
      where.customer = { leadStatus, environment };
    }

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        customer: true,
        messages: {
          orderBy: { sentAt: "desc" },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    return NextResponse.json({
      status: "success",
      conversations,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
