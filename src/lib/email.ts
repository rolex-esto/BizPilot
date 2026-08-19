import nodemailer from "nodemailer";

/**
 * Gmail SMTP transporter for BizPilot.
 * 
 * Requires a Gmail App Password (not your regular Gmail password).
 * Generate one at: https://myaccount.google.com/apppasswords
 * 
 * Set these in your .env file:
 *   SMTP_EMAIL=bizpilot.mailer@gmail.com
 *   SMTP_PASSWORD=your-app-password-here
 *   NEXT_PUBLIC_APP_URL=https://yourdomain.com (for production)
 */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL || "bizpilot.mailer@gmail.com",
    pass: process.env.SMTP_PASSWORD || "",
  },
});

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Sends a transactional email via Gmail SMTP.
 * Falls back to console logging if SMTP_PASSWORD is not configured.
 * 
 * This is for individual transactional emails (verification, password reset, etc.).
 * No bulk/marketing headers are used.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpEmail = process.env.SMTP_EMAIL || "bizpilot.mailer@gmail.com";

  if (!smtpPassword) {
    // Fallback: log to console when no SMTP password configured
    console.log("\n📧 EMAIL (console fallback — set SMTP_PASSWORD to send real emails)");
    console.log(`   To: ${options.to}`);
    console.log(`   Subject: ${options.subject}`);
    console.log(`   Body: [HTML email]`);
    console.log("");
    return true;
  }

  try {
    await transporter.sendMail({
      from: {
        name: "BizPilot",
        address: smtpEmail,
      },
      replyTo: smtpEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
    });
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
}

/**
 * Sends a 6-digit approval code to the authorized Admin email for sensitive actions
 * (e.g. Grant Admin Access, Grant Lifetime Access).
 */
export async function sendAdminApprovalOtpEmail(
  adminEmail: string,
  actionTitle: string,
  targetDescription: string,
  otpCode: string
): Promise<boolean> {
  const subject = "BizPilot Admin Security Code";
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .badge { display: inline-block; padding: 6px 12px; border-radius: 9999px; background-color: #fef3c7; color: #92400e; font-weight: 700; font-size: 11px; text-transform: uppercase; margin-bottom: 16px; }
          h2 { margin: 0 0 8px 0; font-size: 20px; font-weight: 900; color: #0f172a; }
          p { margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #475569; }
          .otp-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0; }
          .otp-code { font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #0f172a; }
          .target-info { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 20px; font-size: 13px; color: #334155; }
          .footer { font-size: 12px; color: #94a3b8; margin-top: 24px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">Security Code Required</span>
          <h2>BizPilot Admin Security Code</h2>
          <p>Someone is requesting approval for a sensitive action in your BizPilot administrator account.</p>
          
          <div class="target-info">
            <strong>Action:</strong> ${actionTitle}<br>
            <strong>Target:</strong> ${targetDescription}
          </div>

          <p>Your 6-digit security code is:</p>
          
          <div class="otp-box">
            <span class="otp-code">${otpCode}</span>
          </div>

          <p style="font-size: 12px; color: #64748b;">
            ⏰ This security code expires in <strong>10 minutes</strong> and can only be used once.
          </p>

          <p style="font-size: 12px; color: #94a3b8;">
            If you did not request this action, do not share this code and review your administrator account security.
          </p>

          <div class="footer">
            BizPilot Platform Security • System Notification
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: adminEmail,
    subject,
    html,
  });
}

/**
 * Sends a 6-digit OTP code to the user's CURRENT email address to authorize an email change.
 */
export async function sendCurrentEmailChangeOtpEmail(
  currentEmail: string,
  userName: string,
  otpCode: string
): Promise<boolean> {
  const subject = "Verify your current email to change your BizPilot login";
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .badge { display: inline-block; padding: 6px 12px; border-radius: 9999px; background-color: #f3e8ff; color: #6b21a8; font-weight: 700; font-size: 11px; text-transform: uppercase; margin-bottom: 16px; }
          h2 { margin: 0 0 8px 0; font-size: 20px; font-weight: 900; color: #0f172a; }
          p { margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #475569; }
          .otp-box { background: #f8fafc; border: 2px dashed #a855f7; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0; }
          .otp-code { font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #6b21a8; }
          .footer { font-size: 12px; color: #94a3b8; margin-top: 24px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">Security Step 1 of 2</span>
          <h2>Verify Your Current Email</h2>
          <p>Hi ${userName},</p>
          <p>We received a request to change the login email address for your BizPilot account. To ensure your account's safety, please verify your current email first.</p>
          
          <div class="otp-box">
            <span class="otp-code">${otpCode}</span>
          </div>

          <p style="font-size: 12px; color: #64748b;">
            ⏰ This code expires in <strong>10 minutes</strong> and can only be used once.
          </p>

          <p style="font-size: 12px; color: #ef4444; font-weight: 600;">
            If you did not request this email change, change your account password immediately.
          </p>

          <div class="footer">
            BizPilot Platform Security • Never share this code with anyone
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: currentEmail,
    subject,
    html,
  });
}

/**
 * Sends a 6-digit OTP code to the user's NEW email address to confirm ownership.
 */
export async function sendNewEmailVerificationOtpEmail(
  newEmail: string,
  userName: string,
  otpCode: string
): Promise<boolean> {
  const subject = "Verify your new BizPilot login email address";
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .badge { display: inline-block; padding: 6px 12px; border-radius: 9999px; background-color: #dcfce7; color: #166534; font-weight: 700; font-size: 11px; text-transform: uppercase; margin-bottom: 16px; }
          h2 { margin: 0 0 8px 0; font-size: 20px; font-weight: 900; color: #0f172a; }
          p { margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #475569; }
          .otp-box { background: #f8fafc; border: 2px dashed #22c55e; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0; }
          .otp-code { font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #15803d; }
          .footer { font-size: 12px; color: #94a3b8; margin-top: 24px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">Security Step 2 of 2</span>
          <h2>Confirm Your New Email</h2>
          <p>Hi ${userName},</p>
          <p>Please enter this 6-digit confirmation code in BizPilot to confirm that this is your new login email address.</p>
          
          <div class="otp-box">
            <span class="otp-code">${otpCode}</span>
          </div>

          <p style="font-size: 12px; color: #64748b;">
            ⏰ This code expires in <strong>10 minutes</strong>. Once entered, your BizPilot login email will be updated.
          </p>

          <div class="footer">
            BizPilot Platform Security • System Notification
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: newEmail,
    subject,
    html,
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


