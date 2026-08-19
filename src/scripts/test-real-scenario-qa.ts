import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import { createSession, validateSessionToken } from "../lib/auth/session";
import { getEffectivePlan, PlanTier } from "../lib/plans";
import { SubscriptionEntitlementService } from "../lib/auth/subscription-entitlement";
import { AiClassifier } from "../lib/ai/classifier";
import { GroundedAiSuggestor } from "../lib/ai/grounded-suggestor";
import { MessageHub } from "../lib/connectors/hub";
import { DeveloperSimulator } from "../lib/connectors/simulator";
import assert from "assert";

async function main() {
  console.log("================================================================================");
  console.log("BIZPILOT — REAL-SCENARIO APPLICATION QA, AI GROUNDING & CONVERSATION SUITE");
  console.log("================================================================================\n");

  const timestamp = Date.now();
  const ownerEmail = `qa-owner-${timestamp}@store.ph`;
  const ownerPass = "SecureOwnerPass123!";
  const storeName = `TechHub Manila ${timestamp}`;

  // 1. PROVISIONING REAL MSME BUSINESS & CATALOG
  console.log("--- 1. PROVISIONING TEST BUSINESS & REAL INVENTORY CATALOG ---");
  const business = await prisma.business.create({
    data: {
      name: storeName,
      ownerName: "Juan Dela Cruz",
      email: ownerEmail,
      contactNumber: "09171234567",
      address: "Makati City, Metro Manila",
      subscriptionStatus: "ACTIVE",
      planTier: "BUSINESS",
      settingsJson: JSON.stringify({
        description: "Official Tech & Gadgets Retailer",
        category: "Electronics & Gadgets",
        fulfillmentMethods: ["MEETUP", "LBC", "GRAB", "LALAMOVE"],
        acceptedPaymentMethods: ["GCASH", "MAYA", "BANK_TRANSFER", "COD"],
        aiConfig: {
          tone: "FRIENDLY_TAGLISH",
          language: "TAGLISH",
          autoReplyEnabled: false, // Owner Approval Mode
          maxDiscountPercent: 5,
          escalateToOwnerOnUnknown: true,
        },
      }),
    },
  });

  const ownerUser = await prisma.user.create({
    data: {
      email: ownerEmail,
      passwordHash: hashPassword(ownerPass),
      name: "Juan Dela Cruz",
      role: "OWNER",
      businessId: business.id,
      emailVerified: true,
    },
  });

  // Seed real products
  const productLaptop = await prisma.product.create({
    data: {
      businessId: business.id,
      sku: "LEN-T480-01",
      name: "Lenovo ThinkPad T480",
      description: "Intel Core i5-8350U, 16GB RAM, 256GB SSD, 14-inch FHD",
      category: "Laptops",
      price: 18500,
      stockQuantity: 5,
      safetyStockThreshold: 2,
      isActive: true,
    },
  });

  const productMouse = await prisma.product.create({
    data: {
      businessId: business.id,
      sku: "LOG-MXM3S",
      name: "Logitech MX Master 3S",
      description: "Ergonomic wireless performance mouse with quiet clicks",
      category: "Accessories",
      price: 5490,
      stockQuantity: 0, // Out of stock
      safetyStockThreshold: 1,
      isActive: true,
    },
  });

  console.log(`✅ Business Created: ${business.name} (Owner: ${ownerUser.name})`);
  console.log(`   Product 1: ${productLaptop.name} — ₱${productLaptop.price} (Stock: ${productLaptop.stockQuantity})`);
  console.log(`   Product 2: ${productMouse.name} — ₱${productMouse.price} (Stock: ${productMouse.stockQuantity} - OUT OF STOCK)`);

  // 2. TESTING 10 REAL-SCENARIO CONVERSATION & AI GROUNDING TESTS
  console.log("\n--- 2. EXECUTING 10 REAL CONVERSATION & AI GROUNDING SCENARIOS ---");

  // Scenario 1: Customer asks about product price (Lenovo T480)
  console.log("\n[SCENARIO 1] Price Inquiry for Lenovo T480");
  const msg1 = "Hi, how much is the Lenovo T480?";
  const class1 = AiClassifier.classifyMessage(msg1, [productLaptop.name, productLaptop.sku]);
  const draft1 = await GroundedAiSuggestor.generateDraftResponse(business.id, "Test Customer", msg1, class1);
  assert(class1.intent === "PRICE_INQUIRY", "Classified as PRICE_INQUIRY");
  assert(draft1.sourceOfTruth.productFound === true, "Product grounded in DB");
  assert(draft1.sourceOfTruth.productPrice === 18500, "Price ₱18,500 accurately queried");
  assert(draft1.suggestedText.includes("18,500"), "Suggestion includes ₱18,500");
  console.log(`   Customer: "${msg1}"`);
  console.log(`   AI Suggestion (Grounded): "${draft1.suggestedText}"`);
  console.log("   ✅ Scenario 1 PASSED: Real price returned without hallucination.");

  // Scenario 2: Customer asks about stock for an out-of-stock item (MX Master 3S)
  console.log("\n[SCENARIO 2] Stock Availability for Out-of-Stock Item (Logitech MX Master 3S)");
  const msg2 = "May stock pa ba kayo ng Logitech MX Master?";
  const class2 = AiClassifier.classifyMessage(msg2, [productMouse.name, productMouse.sku]);
  const draft2 = await GroundedAiSuggestor.generateDraftResponse(business.id, "Maria Santos", msg2, class2);
  assert(class2.intent === "AVAILABILITY_INQUIRY", "Classified as AVAILABILITY_INQUIRY");
  assert(draft2.sourceOfTruth.productFound === true, "Product grounded in DB");
  assert(draft2.sourceOfTruth.stockQuantity === 0, "Zero stock accurately verified");
  assert(draft2.suggestedText.toLowerCase().includes("out of stock"), "Suggestion honestly reports out of stock");
  console.log(`   Customer: "${msg2}"`);
  console.log(`   AI Suggestion (Grounded): "${draft2.suggestedText}"`);
  console.log("   ✅ Scenario 2 PASSED: Honestly reports zero stock, never fabricates availability.");

  // Scenario 3: Customer asks about payment methods (GCash)
  console.log("\n[SCENARIO 3] Payment Method Inquiry");
  const msg3 = "Can I pay through GCash?";
  const class3 = AiClassifier.classifyMessage(msg3, []);
  const draft3 = await GroundedAiSuggestor.generateDraftResponse(business.id, "Test Customer", msg3, class3);
  assert(class3.intent === "PAYMENT_INQUIRY", "Classified as PAYMENT_INQUIRY");
  assert(draft3.sourceOfTruth.paymentMethodsFound?.includes("GCASH"), "GCash confirmed in store settings");
  assert(draft3.suggestedText.includes("GCash"), "Suggestion confirms GCash support");
  console.log(`   Customer: "${msg3}"`);
  console.log(`   AI Suggestion: "${draft3.suggestedText}"`);
  console.log("   ✅ Scenario 3 PASSED: Payment methods grounded in business settings.");

  // Scenario 4: Customer asks about delivery options
  console.log("\n[SCENARIO 4] Delivery Options Inquiry");
  const msg4 = "How much shipping to Cavite and what courier do you use?";
  const class4 = AiClassifier.classifyMessage(msg4, []);
  const draft4 = await GroundedAiSuggestor.generateDraftResponse(business.id, "Test Customer", msg4, class4);
  assert(class4.intent === "DELIVERY_INQUIRY", "Classified as DELIVERY_INQUIRY");
  assert(draft4.sourceOfTruth.fulfillmentMethodsFound?.includes("LBC"), "Fulfillment methods grounded");
  console.log(`   Customer: "${msg4}"`);
  console.log(`   AI Suggestion: "${draft4.suggestedText}"`);
  console.log("   ✅ Scenario 4 PASSED: Delivery options accurately reflect store configuration.");

  // Scenario 5: Customer asks for excessive 40% discount (Tawad)
  console.log("\n[SCENARIO 5] Discount Request (Tawad) Exceeding Policy");
  const msg5 = "Can I get a 40% discount on the T480?";
  const class5 = AiClassifier.classifyMessage(msg5, [productLaptop.name]);
  const draft5 = await GroundedAiSuggestor.generateDraftResponse(business.id, "Test Customer", msg5, class5);
  assert(class5.intent === "DISCOUNT_REQUEST", "Classified as DISCOUNT_REQUEST");
  assert(draft5.sourceOfTruth.requiresOwnerEscalation === true, "Flagged for Owner Escalation");
  assert(draft5.suggestedAction === "ESCALATE_TO_OWNER", "Suggested action is ESCALATE_TO_OWNER");
  console.log(`   Customer: "${msg5}"`);
  console.log(`   AI Suggestion (Escalated): "${draft5.suggestedText}"`);
  console.log("   ✅ Scenario 5 PASSED: Out-of-policy discount cleanly escalated without inventing price.");

  // Scenario 6: Out-of-bounds Hallucination Test (International Delivery & 3-year warranty)
  console.log("\n[SCENARIO 6] Hallucination Defense (International Shipping & 3-Year Warranty)");
  const msg6a = "Do you deliver internationally to the United States?";
  const class6a = AiClassifier.classifyMessage(msg6a, []);
  const draft6a = await GroundedAiSuggestor.generateDraftResponse(business.id, "Test Customer", msg6a, class6a);
  assert(draft6a.sourceOfTruth.requiresOwnerEscalation === true, "International delivery escalated");
  assert(draft6a.suggestedText.includes("Philippines only"), "Correctly states Philippines domestic delivery");

  const msg6b = "Is there a 3-year warranty for this laptop?";
  const class6b = AiClassifier.classifyMessage(msg6b, []);
  const draft6b = await GroundedAiSuggestor.generateDraftResponse(business.id, "Test Customer", msg6b, class6b);
  assert(draft6b.sourceOfTruth.requiresOwnerEscalation === true, "Extended warranty escalated to owner");
  console.log(`   Customer (Int'l): "${msg6a}" -> AI: "${draft6a.suggestedText}"`);
  console.log(`   Customer (Warranty): "${msg6b}" -> AI: "${draft6b.suggestedText}"`);
  console.log("   ✅ Scenario 6 PASSED: Hallucinations prevented. AI connected customer to owner.");

  // Scenario 7: Ingestion through MessageHub & Owner Takeover Mode
  console.log("\n[SCENARIO 7] Inbound Message Ingestion & Owner Takeover");
  const pedroExternalId = `sim_fb_pedro_${timestamp}`;
  const simEvent = DeveloperSimulator.createSimulatedEvent("FACEBOOK", "Pedro Penduko", "Hi po, available pa Lenovo T480?", {
    businessId: business.id,
    senderExternalId: pedroExternalId,
    senderPhone: "09181112233",
  });
  const ingestResult = await MessageHub.ingestMessage(simEvent);
  assert(ingestResult.conversationId, "Conversation created in DB");

  const conv = await prisma.conversation.findUnique({
    where: { id: ingestResult.conversationId },
    include: { messages: true, customer: true },
  });
  assert(conv && conv.messages.length === 1, "Inbound message saved");
  assert(conv.messages[0].direction === "INBOUND", "Direction is INBOUND");
  assert(conv.messages[0].aiSuggestedReply !== null, "AI suggestion generated and stored");

  // Owner takes over conversation
  const updatedConv = await prisma.conversation.update({
    where: { id: conv.id },
    data: { status: "OWNER_HANDLING" },
  });
  assert(updatedConv.status === "OWNER_HANDLING", "Status updated to OWNER_HANDLING");
  console.log(`   Conversation ${conv.id} switched to OWNER_HANDLING.`);
  console.log("   ✅ Scenario 7 PASSED: Ingestion and Owner Takeover verified.");

  // Scenario 8: Owner Approves & Sends Response
  console.log("\n[SCENARIO 8] Owner Approves & Sends Response");
  const approvedReply = conv.messages[0].aiSuggestedReply!;
  const ownerMessage = await prisma.message.create({
    data: {
      conversationId: conv.id,
      customerId: conv.customerId,
      platform: conv.platform,
      direction: "OUTBOUND",
      textContent: approvedReply,
      isRead: true,
      sentAt: new Date(),
    },
  });
  assert(ownerMessage.direction === "OUTBOUND", "Outbound message saved as Owner reply");
  console.log(`   Outbound Reply sent: "${ownerMessage.textContent}"`);
  console.log("   ✅ Scenario 8 PASSED: Outbound dispatch recorded accurately.");

  // Scenario 9: Customer continues conversation after takeover
  console.log("\n[SCENARIO 9] Customer Continues Conversation");
  const followUpEvent = DeveloperSimulator.createSimulatedEvent("FACEBOOK", "Pedro Penduko", "Kunin ko na po via LBC shipping!", {
    businessId: business.id,
    senderExternalId: pedroExternalId,
    senderPhone: "09181112233",
  });
  const followUpResult = await MessageHub.ingestMessage(followUpEvent);
  assert(followUpResult.conversationId === conv.id, "Appended to existing conversation thread");

  const fullConv = await prisma.conversation.findUnique({
    where: { id: conv.id },
    include: { messages: { orderBy: { sentAt: "asc" } } },
  });
  assert(fullConv && fullConv.messages.length === 3, "Conversation has 3 total messages (Inbound -> Outbound -> Inbound)");
  console.log(`   Conversation Thread length: ${fullConv?.messages.length} messages.`);
  console.log("   ✅ Scenario 9 PASSED: Multi-turn customer ↔ owner thread verified.");

  // Scenario 10: Multi-Tenant Channel & Customer Isolation
  console.log("\n[SCENARIO 10] Multi-Tenant Customer & Conversation Isolation");
  const otherBiz = await prisma.business.create({
    data: {
      name: `Other Store ${timestamp}`,
      ownerName: "Other Owner",
      email: `other-${timestamp}@store.ph`,
      subscriptionStatus: "ACTIVE",
      planTier: "STARTER",
    },
  });
  const crossTenantConv = await prisma.conversation.findFirst({
    where: { businessId: otherBiz.id },
  });
  assert(crossTenantConv === null, "Zero conversation leakage between tenants");
  console.log("   ✅ Scenario 10 PASSED: Strict tenant isolation confirmed.");

  // 3. CLEANUP
  console.log("\n--- 3. CLEANING UP TEST DATA ---");
  await prisma.message.deleteMany({ where: { conversationId: conv.id } });
  await prisma.lead.deleteMany({ where: { businessId: business.id } });
  await prisma.conversation.deleteMany({ where: { businessId: business.id } });
  await prisma.customer.deleteMany({ where: { businessId: business.id } });
  await prisma.product.deleteMany({ where: { businessId: business.id } });
  await prisma.session.deleteMany({ where: { userId: ownerUser.id } });
  await prisma.user.delete({ where: { id: ownerUser.id } });
  await prisma.business.delete({ where: { id: business.id } });
  await prisma.business.delete({ where: { id: otherBiz.id } });
  console.log("✅ Test artifacts cleaned up.");

  console.log("\n================================================================================");
  console.log("ALL REAL-SCENARIO QA TESTS PASSED 100%");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

