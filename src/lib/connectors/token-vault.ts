/**
 * BizPilot Connector Token Vault — Authenticated AES-256-GCM Token Cryptography
 * 
 * Secure token encryption, decryption, and credential masking.
 * Ensures zero plaintext token exposure in database, logs, or API responses.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

function getEncryptionKey(): Buffer {
  const secret = process.env.CONNECTOR_ENCRYPTION_KEY || process.env.APP_SECRET || "bizpilot_default_connector_vault_secret_key_2026_32bytes!!";
  // Derive 32-byte key via SHA-256 to ensure exact key length
  return crypto.createHash("sha256").update(secret).digest();
}

export class TokenVault {
  /**
   * Encrypts a raw OAuth token or API secret using AES-256-GCM.
   * Output format: "enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>"
   */
  public static encrypt(plainToken: string): string {
    if (!plainToken) return "";

    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    let encrypted = cipher.update(plainToken, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `enc:v1:${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts an encrypted token string.
   * Throws or returns null if authentication tag fails or payload is tampered.
   */
  public static decrypt(encryptedToken: string): string | null {
    if (!encryptedToken) return null;

    // Handle non-encrypted fallback in dev/test if legacy string
    if (!encryptedToken.startsWith("enc:v1:")) {
      return encryptedToken;
    }

    try {
      const parts = encryptedToken.split(":");
      if (parts.length !== 5) return null;

      const iv = Buffer.from(parts[2], "hex");
      const authTag = Buffer.from(parts[3], "hex");
      const ciphertext = parts[4];
      const key = getEncryptionKey();

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (err: any) {
      console.error("TokenVault decryption failed (tampered payload or invalid key):", err.message);
      return null;
    }
  }

  /**
   * Masks a token for safe UI display (e.g. "EAAZ...9x7Q" or "••••••••••••••••")
   */
  public static maskToken(rawOrEncryptedToken?: string | null): string {
    if (!rawOrEncryptedToken) return "None configured";
    return "••••••••••••••••";
  }
}
