import { NextRequest, NextResponse } from "next/server";
import { OAuthStateManager } from "@/lib/connectors/oauth-state";
import { OAuthManager } from "@/lib/connectors/oauth-manager";

export const dynamic = "force-dynamic";

/**
 * GET /api/channels/oauth/callback/[platform]
 * Handles OAuth callback from Meta/ByteDance, validates state token, exchanges code, and saves connection.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platform = params.platform.toUpperCase();
  const origin = req.headers.get("origin") || req.nextUrl.origin || "https://biz-pilot-1ltn.vercel.app";
  const { searchParams } = new URL(req.url);

  const error = searchParams.get("error");
  const errorReason = searchParams.get("error_reason") || searchParams.get("error_description");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // 1. Handle user cancellation or platform rejection
  if (error) {
    const reason = error === "access_denied" ? "cancelled" : (errorReason || error);
    return NextResponse.redirect(`${origin}/channels?oauth_error=${encodeURIComponent(reason)}&platform=${platform}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/channels?oauth_error=missing_code_or_state&platform=${platform}`);
  }

  try {
    // 2. Validate Signed OAuth State
    const statePayload = OAuthStateManager.validateState(state);
    const redirectUri = `${origin}/api/channels/oauth/callback/${platform.toLowerCase()}`;

    // 3. Exchange authorization code for user access token
    const tokenResult = await OAuthManager.exchangeCodeForUserToken({
      platform,
      code,
      redirectUri,
    });

    // 4. Discover eligible business pages / accounts
    const discoveredAccounts = await OAuthManager.discoverAvailableAccounts({
      platform,
      userAccessToken: tokenResult.userAccessToken,
    });

    if (discoveredAccounts.length === 0) {
      return NextResponse.redirect(`${origin}/channels?oauth_error=no_eligible_pages_found&platform=${platform}`);
    }

    // 5. If exactly one page, auto-connect immediately
    if (discoveredAccounts.length === 1) {
      const selected = discoveredAccounts[0];
      await OAuthManager.saveConnectedAccount({
        businessId: statePayload.businessId,
        platform,
        account: selected,
      });

      return NextResponse.redirect(
        `${origin}/channels?oauth_success=true&platform=${platform}&accountName=${encodeURIComponent(selected.platformAccountName)}`
      );
    }

    // 6. If multiple pages available, pass session token for selection UI
    const encodedAccounts = Buffer.from(JSON.stringify(discoveredAccounts), "utf8").toString("base64url");
    const selectionState = OAuthStateManager.generateState({
      businessId: statePayload.businessId,
      platform,
      redirectUri: encodedAccounts, // temporary store in signed state
    });

    return NextResponse.redirect(
      `${origin}/channels?oauth_select=true&platform=${platform}&sessionToken=${encodeURIComponent(selectionState)}`
    );
  } catch (err: any) {
    console.error("OAuth callback processing error:", err.message);
    return NextResponse.redirect(
      `${origin}/channels?oauth_error=${encodeURIComponent(err.message || "Authorization failed")}&platform=${platform}`
    );
  }
}
