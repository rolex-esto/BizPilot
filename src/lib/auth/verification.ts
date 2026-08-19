import { getAppUrl } from "../config/url";

/**
 * Generates the verification URL for inclusion in emails.
 * Uses NEXT_PUBLIC_APP_URL for production, falls back to localhost for development.
 */
export function getVerificationUrl(token: string, baseUrl?: string): string {
  const base = baseUrl || getAppUrl();
  return `${base}/verify-email?token=${token}`;
}

/**
 * Sends the account activation email.
 * 
 * This is a transactional email — one email per signup action.
 * No bulk headers, no marketing language, no artificial urgency.
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  verificationUrl: string
): Promise<boolean> {
  const { sendEmail } = await import("../email");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activate your BizPilot account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 16px; text-align: center;">
              <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #0284c7, #4338ca); border-radius: 12px; display: inline-block; line-height: 48px; text-align: center;">
                <span style="color: white; font-size: 20px; font-weight: bold;">B</span>
              </div>
              <h1 style="margin: 12px 0 0; font-size: 20px; color: #0f172a; font-weight: 700;">BizPilot</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 16px 32px 32px;">
              <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; font-weight: 600;">Hi ${name},</p>
              <p style="margin: 0 0 24px; font-size: 14px; color: #475569; line-height: 1.6;">
                Welcome to BizPilot. Please activate your account by clicking the button below.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <a href="${verificationUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 700; text-align: center;">
                      Activate My Account
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 12px; font-size: 13px; color: #64748b; line-height: 1.5;">
                If the button does not work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; font-size: 12px; color: #475569; word-break: break-all; line-height: 1.4;">
                ${verificationUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

              <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                This link expires in 24 hours.
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                If you did not create a BizPilot account, please ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 32px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                BizPilot — AI Operations for Philippine MSMEs
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Hi ${name},

Welcome to BizPilot. Please activate your account by opening this link:

${verificationUrl}

This link expires in 24 hours.

If you did not create a BizPilot account, please ignore this email.

Thank you,
BizPilot`;

  const sent = await sendEmail({
    to: email,
    subject: "Activate your BizPilot account",
    html,
    text,
  });

  if (sent) {
    console.log(`Verification email sent to: ${email}`);
    console.log(`  Verify URL: ${verificationUrl}`);
  } else {
    console.error(`Failed to send verification email to: ${email}`);
  }

  return sent;
}

