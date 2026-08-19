import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guard";
import { executeApprovalAction } from "@/lib/auth/admin-approval";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/approval/confirm
 * Atomically executes the verified sensitive action and consumes the request.
 */
export async function POST(req: NextRequest) {
  try {
    const { user: currentAdmin, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { requestId } = body;

    if (!requestId) {
      return NextResponse.json({ error: "Approval request ID is required." }, { status: 400 });
    }

    const result = await executeApprovalAction({
      requestId,
      adminId: currentAdmin!.id,
      adminEmail: currentAdmin!.email,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
    }

    return NextResponse.json({
      status: "success",
      message: result.message,
      actionType: result.actionType,
    });
  } catch (error: any) {
    console.error("Admin approval confirm error:", error);
    return NextResponse.json({ error: "Failed to execute approved action." }, { status: 500 });
  }
}
