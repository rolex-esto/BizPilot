import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";
import { PlatformConnectionValidator } from "@/lib/connectors/connection-validator";

export const dynamic = "force-dynamic";

/**
 * POST /api/channels/test
 * 
 * Authoritative connection validation endpoint.
 * Requires session auth, tenant authorization, and exact connection targeting.
 * Validates real platform API authentication, identity matching, and capability verification.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, businessId: authBizId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json().catch(() => ({}));
    const { connectionId, platform, platformAccountId, businessId: reqBizId } = body;
    const businessId = authBizId || reqBizId;

    if (!businessId) {
      return NextResponse.json({ error: "Business ID is required." }, { status: 400 });
    }

    let targetConnectionId = connectionId;

    // 1. Resolve exact target connection
    if (!targetConnectionId) {
      if (platformAccountId && platform) {
        const found = await prisma.platformConnection.findFirst({
          where: { businessId, platform, platformAccountId },
        });
        if (found) targetConnectionId = found.id;
      } else if (platform) {
        // Find the most recently active or latest connection for this platform
        const found = await prisma.platformConnection.findFirst({
          where: { businessId, platform },
          orderBy: [
            { status: "asc" }, // Prioritize CONNECTED or NEEDS_REAUTH over DISCONNECTED if possible
            { updatedAt: "desc" },
          ],
        });
        if (found) targetConnectionId = found.id;
      }
    }

    if (!targetConnectionId) {
      return NextResponse.json(
        {
          status: "failed",
          overallPassed: false,
          connected: false,
          healthCategory: "MISSING_CREDENTIALS",
          message: "No connection record found for this channel in your workspace.",
          friendlyMessage: "This channel is not connected yet. Connect it first, then run the test again.",
          results: [
            {
              step: "Account Record",
              passed: false,
              message: "No connection record found in your workspace.",
            },
          ],
        },
        { status: 404 }
      );
    }

    // 2. Authoritative Platform Connection Validation
    const validationResult = await PlatformConnectionValidator.validateConnection(
      targetConnectionId,
      businessId
    );

    return NextResponse.json({
      status: validationResult.connected ? "passed" : "issues",
      platform: validationResult.platform,
      overallPassed: validationResult.connected,
      connected: validationResult.connected,
      connectionStatus: validationResult.status,
      healthCategory: validationResult.reasonCode || (validationResult.connected ? "REAL_API_PASS" : "REAL_API_FAIL"),
      latencyMs: validationResult.latencyMs,
      httpStatus: validationResult.httpStatus || (validationResult.connected ? 200 : 400),
      reasonCode: validationResult.reasonCode,
      message: validationResult.message,
      friendlyMessage: validationResult.message,
      health: validationResult.health,
      results: validationResult.results,
      connectionInfo: validationResult.connectionInfo,
    });
  } catch (error: any) {
    if (error.message === "CONNECTION_NOT_FOUND") {
      return NextResponse.json({ error: "Connection record not found in workspace." }, { status: 404 });
    }
    console.error("POST /api/channels/test error:", error);
    return NextResponse.json(
      { error: "Test failed unexpectedly. Please try again.", details: error.message },
      { status: 500 }
    );
  }
}
