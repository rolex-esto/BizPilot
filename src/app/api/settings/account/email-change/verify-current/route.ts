import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-guard";
import { verifyCurrentEmailOtp } from "@/lib/auth/email-change";

export const dynamic = "force-dynamic";

/**
 * POST /api/settings/account/email-change/verify-current
 * Step 2: Validates the 6-digit OTP sent to the user's CURRENT email.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { requestId, otp } = body;

    if (!requestId || typeof requestId !== "string") {
      return NextResponse.json({ error: "Verification request ID is required." }, { status: 400 });
    }

    if (!otp || typeof otp !== "string" || otp.trim().length !== 6) {
      return NextResponse.json({ error: "Please enter a valid 6-digit verification code." }, { status: 400 });
    }

    const result = await verifyCurrentEmailOtp({
      requestId,
      userId: user!.id,
      otp: otp.trim(),
    });

    if (result.error) {
      const statusCode = result.code === "NOT_FOUND" ? 404 : result.code === "UNAUTHORIZED" ? 403 : 400;
      return NextResponse.json(
        { error: result.error, code: result.code, attemptsRemaining: result.attemptsRemaining },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      status: "success",
      message: "Current email verified successfully.",
      requestId: result.requestId,
      currentEmailVerified: true,
    });
  } catch (error: any) {
    console.error("Verify current email OTP error:", error);
    return NextResponse.json({ error: "Failed to verify current email code." }, { status: 500 });
  }
}
