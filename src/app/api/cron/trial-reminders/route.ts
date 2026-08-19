import { NextRequest, NextResponse } from "next/server";
import { processTrialReminders } from "@/lib/trial-reminders";

/**
 * GET /api/cron/trial-reminders
 * 
 * Processes trial reminder emails for all businesses.
 * Designed to be called by a cron job or scheduler (e.g., Vercel Cron, external scheduler).
 * 
 * Idempotent — safe to call multiple times. Each milestone is only sent once per business.
 * 
 * Optional: Add a secret header for production security:
 * Authorization: Bearer <CRON_SECRET>
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Optional: verify cron secret for production
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const result = await processTrialReminders();

    return NextResponse.json({
      status: "success",
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Cron trial-reminders error:", error);
    return NextResponse.json({ error: "Failed to process reminders" }, { status: 500 });
  }
}
