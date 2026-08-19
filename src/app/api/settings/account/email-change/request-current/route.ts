import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-guard";
import { requestCurrentEmailVerification } from "@/lib/auth/email-change";

export const dynamic = "force-dynamic";

/**
 * POST /api/settings/account/email-change/request-current
 * Step 1: Initiates email change by sending a 6-digit OTP to the user's CURRENT email.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const result = await requestCurrentEmailVerification({
      userId: user!.id,
    });

    if (result.error) {
      const statusCode = result.code === "USER_NOT_FOUND" ? 404 : result.cooldownRemaining ? 429 : 400;
      return NextResponse.json(
        { error: result.error, code: result.code, cooldownRemaining: result.cooldownRemaining, requestId: result.requestId },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      status: "success",
      message: "Verification code sent to your current email address.",
      requestId: result.requestId,
      maskedCurrentEmail: result.maskedCurrentEmail,
      expiresAt: result.expiresAt,
      cooldownRemaining: result.cooldownRemaining,
    });
  } catch (error: any) {
    console.error("Request current email OTP error:", error);
    return NextResponse.json({ error: "Failed to initiate email change verification." }, { status: 500 });
  }
}
