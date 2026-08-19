import { MessageHub } from "../lib/connectors/hub";
import { DeveloperSimulator } from "../lib/connectors/simulator";
import { prisma } from "../lib/prisma";

async function testNormalization() {
  console.log("=== TEST 1: Message Normalization & Idempotency ===");

  const simEvent = DeveloperSimulator.createSimulatedEvent(
    "FACEBOOK",
    "Test Customer Juan",
    "Testing normalized inbound message for Lenovo T480",
    { senderHandle: "juan.test" }
  );

  console.log("Ingesting initial message...");
  const result1 = await MessageHub.ingestMessage(simEvent);
  console.log("Ingestion 1:", result1);

  if (result1.isDuplicate) {
    throw new Error("Initial message was incorrectly marked as duplicate.");
  }

  console.log("Re-ingesting identical message with same externalMessageId (Idempotency check)...");
  const result2 = await MessageHub.ingestMessage(simEvent);
  console.log("Ingestion 2:", result2);

  if (!result2.isDuplicate) {
    throw new Error("Duplicate message was not caught by idempotency check!");
  }

  console.log("✅ TEST 1 PASSED: Normalization & Idempotency verified.");
}

testNormalization()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test 1 Failed:", err);
    process.exit(1);
  });
