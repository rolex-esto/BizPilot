import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth } from "@/lib/auth/api-guard";
import { OAuthStateManager } from "@/lib/connectors/oauth-state";
import { OAuthManager, DiscoveredAccount } from "@/lib/connectors/oauth-manager";

export const dynamic = "force-dynamic";

/**
 * POST /api/channels/oauth/select-account
 * Allows the business owner to select which discovered Page to link to BizPilot.
 */
export async function POST(req: NextRequest) {
  try {
    const { businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { sessionToken, selectedAccountId, platform } = body;

    if (!sessionToken || !selectedAccountId) {
      return NextResponse.json({ error: "Missing selection session token or selected account ID." }, { status: 400 });
    }

    // Validate signed session state token
    const statePayload = OAuthStateManager.validateState(sessionToken, businessId || undefined);
    const encodedAccounts = statePayload.redirectUri;
    if (!encodedAccounts) {
      return NextResponse.json({ error: "Selection session expired. Please connect again." }, { status: 400 });
    }

    let accounts: DiscoveredAccount[] = [];
    try {
      accounts = JSON.parse(Buffer.from(encodedAccounts, "base64url").toString("utf8"));
    } catch {
      return NextResponse.json({ error: "Corrupt selection session." }, { status: 400 });
    }

    const selectedAccount = accounts.find((a) => a.platformAccountId === selectedAccountId);
    if (!selectedAccount) {
      return NextResponse.json({ error: "Selected account not found in discovered list." }, { status: 404 });
    }

    const connection = await OAuthManager.saveConnectedAccount({
      businessId: statePayload.businessId,
      platform: platform || statePayload.platform,
      account: selectedAccount,
    });

    return NextResponse.json({
      status: "success",
      connection: {
        id: connection.id,
        platform: connection.platform,
        platformAccountId: connection.platformAccountId,
        platformAccountName: connection.platformAccountName,
        status: connection.status,
        statusMessage: connection.statusMessage,
      },
    });
  } catch (err: any) {
    console.error("Account selection error:", err.message);
    return NextResponse.json({ error: err.message || "Failed to complete account selection." }, { status: 500 });
  }
}
