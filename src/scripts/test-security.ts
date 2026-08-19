import crypto from "crypto";
import { verifyMetaSignature, verifyMetaWebhookHandshake } from "../lib/connectors/security";

async function testSecurity() {
  console.log("=== TEST 4: Security & Webhook Signature Validation ===");

  const appSecret = "secure_app_secret_key_12345";
  const rawBody = JSON.stringify({ object: "page", entry: [{ id: "123", time: 1600000000 }] });

  // 1. Calculate Valid Signature
  const hmac = crypto.createHmac("sha256", appSecret);
  hmac.update(rawBody);
  const validSignatureHeader = `sha256=${hmac.digest("hex")}`;

  const isValid = verifyMetaSignature(rawBody, validSignatureHeader, appSecret);
  console.log("Valid signature verification result:", isValid);
  if (!isValid) throw new Error("Valid HMAC-SHA256 signature was rejected!");

  // 2. Tampered Payload (Must be rejected)
  const tamperedBody = JSON.stringify({ object: "page", entry: [{ id: "HACKED" }] });
  const isTamperedValid = verifyMetaSignature(tamperedBody, validSignatureHeader, appSecret);
  console.log("Tampered body rejected:", !isTamperedValid);
  if (isTamperedValid) throw new Error("Tampered payload was accepted!");

  // 3. Webhook Handshake Challenge Test
  const handshake = verifyMetaWebhookHandshake("subscribe", "my_token", "challenge_12345", "my_token");
  if (!handshake.isValid || handshake.challenge !== "challenge_12345") {
    throw new Error("Meta webhook handshake verification failed!");
  }

  console.log("✅ TEST 4 PASSED: Cryptographic Security & Webhook Signatures verified.");
}

testSecurity()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test 4 Failed:", err);
    process.exit(1);
  });
