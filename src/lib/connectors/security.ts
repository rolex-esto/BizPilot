import crypto from "crypto";

/**
 * Verifies the X-Hub-Signature-256 header sent by Meta (Facebook, Instagram, WhatsApp)
 * using HMAC SHA-256 against the configured APP_SECRET.
 */
export function verifyMetaSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) {
    return false;
  }

  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }

  const expectedSignature = parts[1];
  const hmac = crypto.createHmac("sha256", appSecret);
  hmac.update(rawBody);
  const calculatedSignature = hmac.digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature, "utf8"),
      Buffer.from(expectedSignature, "utf8")
    );
  } catch {
    return false;
  }
}

/**
 * Validates Meta Webhook handshake challenge for GET requests
 */
export function verifyMetaWebhookHandshake(
  mode: string | null,
  token: string | null,
  challenge: string | null,
  expectedVerifyToken: string
): { isValid: boolean; challenge?: string } {
  if (mode === "subscribe" && token === expectedVerifyToken && challenge) {
    return { isValid: true, challenge };
  }
  return { isValid: false };
}
