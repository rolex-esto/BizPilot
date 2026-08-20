/**
 * BizPilot Production-Grade OAuth State & CSRF Protection Subsystem
 * 
 * Provides cryptographically signed, short-lived, single-use, tenant-isolated OAuth state tokens.
 * Prevents OAuth CSRF, authorization replay, account linking attacks, and cross-tenant leakage.
 */

import crypto from "crypto";

export interface OAuthStatePayload {
  businessId: string;
  userId?: string;
  platform: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  redirectUri?: string;
  isReconnect?: boolean;
  connectionId?: string;
}

// In-memory replay prevention set for single-use nonces (stores nonce -> expiration timestamp)
const usedNonces = new Map<string, number>();

// Clean up expired nonces every 15 minutes
setInterval(() => {
  const now = Date.now();
  usedNonces.forEach((expiresAt, nonce) => {
    if (now > expiresAt) {
      usedNonces.delete(nonce);
    }
  });
}, 15 * 60 * 1000).unref();

function getSigningKey(): Buffer {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.CONNECTOR_ENCRYPTION_KEY || process.env.APP_SECRET || "bizpilot_production_oauth_signing_secret_key_2026_sha256";
  return crypto.createHash("sha256").update(secret).digest();
}

export class OAuthStateManager {
  private static readonly TTL_MS = 10 * 60 * 1000; // 10 minutes maximum validity

  /**
   * Generates a signed, single-use OAuth state token tied to the authenticated business/user.
   */
  public static generateState(params: {
    businessId: string;
    userId?: string;
    platform: string;
    redirectUri?: string;
    isReconnect?: boolean;
    connectionId?: string;
  }): string {
    const now = Date.now();
    const nonce = crypto.randomBytes(24).toString("hex");

    const payload: OAuthStatePayload = {
      businessId: params.businessId,
      userId: params.userId,
      platform: params.platform.toUpperCase(),
      nonce,
      issuedAt: now,
      expiresAt: now + this.TTL_MS,
      redirectUri: params.redirectUri,
      isReconnect: params.isReconnect,
      connectionId: params.connectionId,
    };

    const jsonStr = JSON.stringify(payload);
    const encodedPayload = Buffer.from(jsonStr, "utf8").toString("base64url");

    const hmac = crypto.createHmac("sha256", getSigningKey());
    hmac.update(encodedPayload);
    const signature = hmac.digest("base64url");

    return `${encodedPayload}.${signature}`;
  }

  /**
   * Validates the state token: checks signature, expiration, single-use, and tenant alignment.
   * Returns the verified payload or throws an error with a human-readable reason.
   */
  public static validateState(stateToken: string, expectedBusinessId?: string): OAuthStatePayload {
    if (!stateToken || typeof stateToken !== "string" || !stateToken.includes(".")) {
      throw new Error("Invalid OAuth state format. Please initiate authorization from BizPilot.");
    }

    const [encodedPayload, providedSignature] = stateToken.split(".");
    if (!encodedPayload || !providedSignature) {
      throw new Error("Malformed OAuth state token.");
    }

    // 1. Verify HMAC Signature
    const hmac = crypto.createHmac("sha256", getSigningKey());
    hmac.update(encodedPayload);
    const expectedSignature = hmac.digest("base64url");

    const sigA = Buffer.from(providedSignature);
    const sigB = Buffer.from(expectedSignature);

    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
      throw new Error("OAuth state signature verification failed. Potential tampering or CSRF attempt.");
    }

    // 2. Decode & Parse Payload
    let payload: OAuthStatePayload;
    try {
      const jsonStr = Buffer.from(encodedPayload, "base64url").toString("utf8");
      payload = JSON.parse(jsonStr);
    } catch {
      throw new Error("Corrupt OAuth state payload.");
    }

    const now = Date.now();

    // 3. Verify Expiration
    if (now > payload.expiresAt) {
      throw new Error("OAuth authorization session expired. Please click connect again.");
    }

    // 4. Single-Use Check (Prevent Replay Attacks)
    if (usedNonces.has(payload.nonce)) {
      throw new Error("OAuth state token has already been used. Please initiate a new connection.");
    }
    // Mark nonce as used with TTL
    usedNonces.set(payload.nonce, payload.expiresAt);

    // 5. Tenant Validation (Prevent Cross-Tenant Account Linking)
    if (expectedBusinessId && payload.businessId !== expectedBusinessId) {
      throw new Error("OAuth state belongs to a different store account. Authorization rejected.");
    }

    return payload;
  }
}
