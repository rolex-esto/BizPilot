import { getAppUrl } from "../config/url";
import { sendEmail } from "../email";

/**
 * Generates the password reset URL.
 */
export function getResetPasswordUrl(token: string, baseUrl?: string): string {
  const base = baseUrl || getAppUrl();
  return `${base}/reset-password?token=${token}`;
}

/**
 * Sends a transactional password reset email.
 * Single-use, expires in 1 hour.
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetUrl: string
): Promise<boolean> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your BizPilot password</title>
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
                We received a request to reset the password for your BizPilot account. Click the button below to choose a new password.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 700; text-align: center;">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 12px; font-size: 13px; color: #64748b; line-height: 1.5;">
                If the button does not work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; font-size: 12px; color: #475569; word-break: break-all; line-height: 1.4;">
                ${resetUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

              <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                This link expires in 1 hour.
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                If you did not request a password reset, no action is needed. Your account remains secure.
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

We received a request to reset your BizPilot account password. Open this link to set a new password:

${resetUrl}

This link expires in 1 hour.

If you did not request a password reset, please ignore this email.

Thank you,
BizPilot`;

  const sent = await sendEmail({
    to: email,
    subject: "Reset your BizPilot password",
    html,
    text,
  });

  if (sent) {
    console.log(`Password reset email sent to: ${email}`);
  } else {
    console.error(`Failed to send password reset email to: ${email}`);
  }

  return sent;
}
