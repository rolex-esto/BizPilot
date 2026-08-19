import { AiClassifier } from "../lib/ai/classifier";
import { GroundedAiSuggestor } from "../lib/ai/grounded-suggestor";
import { prisma } from "../lib/prisma";

async function testGroundedAi() {
  console.log("=== TEST 2: Grounded AI Response & Deterministic Validation ===");

  const business = await prisma.business.findFirst();
  if (!business) throw new Error("No business profile found.");

  // 1. Test Known Product (Lenovo T480)
  const query1 = "Available pa po ba yung Lenovo ThinkPad T480? HM po?";
  const class1 = AiClassifier.classifyMessage(query1);
  console.log("Classified Query 1:", class1.intent);

  const draft1 = await GroundedAiSuggestor.generateDraftResponse(
    business.id,
    "Juan Dela Cruz",
    query1,
    class1
  );
  console.log("Draft 1:", draft1.suggestedText);

  if (!draft1.sourceOfTruth.productFound || draft1.sourceOfTruth.productPrice !== 18500) {
    throw new Error("Product price was not grounded in DB records!");
  }

  // 2. Test Unknown Product (Must NOT invent prices or stock)
  const query2 = "How much is the Holographic Quantum Laptop 9999?";
  const class2 = AiClassifier.classifyMessage(query2);
  const draft2 = await GroundedAiSuggestor.generateDraftResponse(
    business.id,
    "Maria Santos",
    query2,
    class2
  );
  console.log("Draft 2 (Unknown Product):", draft2.suggestedText);

  if (draft2.sourceOfTruth.productFound) {
    throw new Error("AI hallucinated an unknown product that does not exist in the database!");
  }

  console.log("✅ TEST 2 PASSED: Deterministic Grounding & No-Hallucination verified.");
}

testGroundedAi()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test 2 Failed:", err);
    process.exit(1);
  });
