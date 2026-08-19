import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guard";
import { verifyApprovalOtp } from "@/lib/auth/admin-approval";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/approval/verify
 * Validates the 6-digit OTP code for an approval request.
 */
export async function POST(req: NextRequest) {
  try {
    const { user: currentAdmin, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { requestId, otp } = body;

    if (!requestId || !otp) {
      return NextResponse.json({ error: "Please enter the 6-digit approval code." }, { status: 400 });
    }

    const result = await verifyApprovalOtp({
      requestId,
      adminId: currentAdmin!.id,
      otp: String(otp).trim(),
    });

    if (result.error) {
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          attemptsRemaining: result.attemptsRemaining,
        },
        { status: result.code === "MAX_ATTEMPTS_EXCEEDED" || result.code === "INVALIDATED" ? 403 : 400 }
      );
    }

    return NextResponse.json({
      status: "success",
      message: "Approval code verified successfully.",
      requestId: result.requestId,
      actionType: result.actionType,
      targetEmail: result.targetEmail,
      targetName: result.targetName,
    });
  } catch (error: any) {
    console.error("Admin approval verify error:", error);
    return NextResponse.json({ error: "Failed to verify approval code." }, { status: 500 });
  }
}
