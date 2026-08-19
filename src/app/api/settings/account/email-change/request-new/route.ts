import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-guard";
import { requestNewEmailVerification } from "@/lib/auth/email-change";

export const dynamic = "force-dynamic";

/**
 * POST /api/settings/account/email-change/request-new
 * Step 3: Submits the NEW email address and dispatches a 6-digit verification code.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { requestId, newEmail } = body;

    if (!requestId || typeof requestId !== "string") {
      return NextResponse.json({ error: "Verification request ID is required." }, { status: 400 });
    }

    if (!newEmail || typeof newEmail !== "string" || !newEmail.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid new email address." }, { status: 400 });
    }

    const result = await requestNewEmailVerification({
      requestId,
      userId: user!.id,
      newEmail: newEmail.trim(),
    });

    if (result.error) {
      const statusCode =
        result.code === "NOT_FOUND" ? 404 :
        result.code === "UNAUTHORIZED" || result.code === "CURRENT_NOT_VERIFIED" ? 403 :
        result.code === "EMAIL_TAKEN" ? 409 :
        result.cooldownRemaining ? 429 : 400;

      return NextResponse.json(
        { error: result.error, code: result.code, cooldownRemaining: result.cooldownRemaining, requestId: result.requestId },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      status: "success",
      message: "Verification code sent to your new email address.",
      requestId: result.requestId,
      newEmail: result.newEmail,
      maskedNewEmail: result.maskedNewEmail,
      expiresAt: result.expiresAt,
      cooldownRemaining: result.cooldownRemaining,
    });
  } catch (error: any) {
    console.error("Request new email OTP error:", error);
    return NextResponse.json({ error: "Failed to dispatch verification code to new email." }, { status: 500 });
  }
}
