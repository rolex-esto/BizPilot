import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth } from "@/lib/auth/api-guard";
import { checkChannelLimit } from "@/lib/auth/plan-guard";
import { OAuthStateManager } from "@/lib/connectors/oauth-state";
import { OAuthManager } from "@/lib/connectors/oauth-manager";

export const dynamic = "force-dynamic";

/**
 * GET /api/channels/oauth/initiate?platform=FACEBOOK
 * Generates a cryptographically signed OAuth authorization URL for the target platform.
 */
export async function GET(req: NextRequest) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    if (!businessId) {
      return NextResponse.json({ error: "Store identification missing from session." }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const platform = (searchParams.get("platform") || "FACEBOOK").toUpperCase();
    const isReconnect = searchParams.get("reconnect") === "true";
    const connectionId = searchParams.get("connectionId") || undefined;

    // Check plan entitlement limit
    if (!isReconnect) {
      const limitError = await checkChannelLimit(businessId, platform);
      if (limitError) return limitError;
    }

    const origin = req.headers.get("origin") || req.nextUrl.origin || "https://biz-pilot-1ltn.vercel.app";
    const redirectUri = `${origin}/api/channels/oauth/callback/${platform.toLowerCase()}`;

    // Generate signed, single-use, anti-CSRF state token
    const stateToken = OAuthStateManager.generateState({
      businessId,
      userId: user?.id,
      platform,
      redirectUri,
      isReconnect,
      connectionId,
    });

    const { authUrl, isConfigured, warning } = OAuthManager.getAuthorizationUrl({
      platform,
      state: stateToken,
      redirectUri,
    });

    return NextResponse.json({
      status: "success",
      platform,
      authUrl,
      isConfigured,
      warning,
      state: stateToken,
    });
  } catch (err: any) {
    console.error("OAuth initiation error:", err.message);
    return NextResponse.json({ error: err.message || "Failed to initiate OAuth authorization." }, { status: 500 });
  }
}
