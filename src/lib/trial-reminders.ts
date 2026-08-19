import { prisma } from "./prisma";
import { sendEmail } from "./email";
import { getAppUrl } from "./config/url";

/**
 * Trial reminder milestones.
 * Each milestone is sent only once per business.
 */
type ReminderMilestone = "TRIAL_7_DAY" | "TRIAL_3_DAY" | "TRIAL_1_DAY" | "TRIAL_EXPIRED";

/**
 * Checks all businesses with active trials and sends appropriate reminder emails.
 * Designed to be called by a scheduler (cron, background job, etc.)
 * 
 * Idempotent: Each milestone is only sent once (tracked in settingsJson).
 */
export async function processTrialReminders(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
}> {
  let processed = 0, sent = 0, skipped = 0, errors = 0;

  const businesses = await prisma.business.findMany({
    where: {
      trialEndsAt: { not: null },
      subscriptionStatus: { in: ["TRIAL", "PENDING_VERIFICATION"] },
    },
  });

  for (const biz of businesses) {
    processed++;
    if (!biz.trialEndsAt || !biz.email) { skipped++; continue; }

    const now = new Date();
    const daysLeft = Math.ceil((biz.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Determine which milestone to send
    let milestone: ReminderMilestone | null = null;
    if (daysLeft <= 0) milestone = "TRIAL_EXPIRED";
    else if (daysLeft <= 1) milestone = "TRIAL_1_DAY";
    else if (daysLeft <= 3) milestone = "TRIAL_3_DAY";
    else if (daysLeft <= 7) milestone = "TRIAL_7_DAY";

    if (!milestone) { skipped++; continue; }

    // Check idempotency — don't send the same milestone twice
    const settings = JSON.parse(biz.settingsJson || "{}");
    const sentMilestones: string[] = settings.sentTrialReminders || [];

    if (sentMilestones.includes(milestone)) { skipped++; continue; }

    // Send the appropriate email
    try {
      const emailSent = await sendTrialReminderEmail(biz.email, biz.ownerName, biz.name, milestone, daysLeft);

      if (emailSent) {
        // Record that this milestone was sent
        sentMilestones.push(milestone);
        await prisma.business.update({
          where: { id: biz.id },
          data: {
            settingsJson: JSON.stringify({ ...settings, sentTrialReminders: sentMilestones }),
            // If trial expired, update status
            ...(milestone === "TRIAL_EXPIRED" ? { subscriptionStatus: "EXPIRED" } : {}),
          },
        });
        sent++;
      } else {
        errors++;
      }
    } catch (err) {
      console.error(`Trial reminder error for ${biz.email}:`, err);
      errors++;
    }
  }

  return { processed, sent, skipped, errors };
}

/**
 * Sends the appropriate trial reminder email based on milestone.
 */
async function sendTrialReminderEmail(
  email: string,
  ownerName: string,
  businessName: string,
  milestone: ReminderMilestone,
  daysLeft: number
): Promise<boolean> {
  const plansUrl = getAppUrl("/pricing");

  const subjects: Record<ReminderMilestone, string> = {
    TRIAL_7_DAY: "Your BizPilot free trial ends in 7 days",
    TRIAL_3_DAY: "Your BizPilot trial ends in 3 days",
    TRIAL_1_DAY: "Your BizPilot trial ends tomorrow",
    TRIAL_EXPIRED: "Your BizPilot free trial has ended",
  };

  const messages: Record<ReminderMilestone, string> = {
    TRIAL_7_DAY: `You have 7 days left in your BizPilot free trial. Choose a plan to keep managing your business after your trial ends.`,
    TRIAL_3_DAY: `Your BizPilot trial ends in 3 days. Don't lose access to your products, orders, and customer messages — choose a plan now.`,
    TRIAL_1_DAY: `Your BizPilot free trial ends tomorrow. Choose a plan today to continue without interruption.`,
    TRIAL_EXPIRED: `Your 30-day free trial has ended. Your business data is still safe — choose a plan to continue using BizPilot.`,
  };

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f8fafc; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #0284c7, #4338ca); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
          <span style="color: white; font-size: 20px; font-weight: bold;">B</span>
        </div>
        <h1 style="margin: 12px 0 4px; font-size: 20px; color: #0f172a;">BizPilot</h1>
      </div>
      
      <div style="background: white; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
        <h2 style="margin: 0 0 12px; font-size: 16px; color: #0f172a;">${subjects[milestone]}</h2>
        <p style="margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.6;">
          Hi ${ownerName},<br><br>
          ${messages[milestone]}
        </p>
        
        <a href="${plansUrl}" style="display: block; text-align: center; padding: 14px 24px; background: linear-gradient(135deg, #7c3aed, #4338ca); color: white; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 700;">
          View Plans
        </a>
        
        <p style="margin: 20px 0 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
          Your products, customers, orders, and business data are safe regardless of your trial status. Choose a plan whenever you're ready.
        </p>
      </div>
    </div>
  `;

  return await sendEmail({
    to: email,
    subject: subjects[milestone],
    html,
    text: `Hi ${ownerName}, ${messages[milestone]} View plans: ${plansUrl}`,
  });
}
