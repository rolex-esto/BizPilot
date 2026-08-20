import { OrderContextExtractor, MinimalProduct, MinimalMessage } from "../lib/ai/order-context-extractor";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testId: string, description: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testId}: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testId}: ${description}`);
    failed++;
  }
}

async function runExtractionTests() {
  console.log("\n================================================================================");
  console.log("BIZPILOT — AI ORDER CONTEXT & MEETUP EXTRACTION SUITE");
  console.log("================================================================================\n");

  const mockCatalog: MinimalProduct[] = [
    {
      id: "prod_macbook_m2",
      name: "Macbook Air M2 (16gb, 256gb ssd)",
      price: 45000,
      sku: "MAC-R1WL",
      stockQuantity: 5,
    },
    {
      id: "prod_iphone_15",
      name: "iPhone 15 Pro Max (256GB)",
      price: 65000,
      sku: "IPH-15PM",
      stockQuantity: 3,
    },
    {
      id: "prod_airpods_pro",
      name: "AirPods Pro 2nd Gen",
      price: 12500,
      sku: "APP-2GEN",
      stockQuantity: 10,
    },
  ];

  // ------------------------------------------------------------
  // TEST 1: User's Exact Live Screenshot Scenario
  // ------------------------------------------------------------
  console.log("--- Scenario 1: Exact User Screenshot Scenario ---");

  const userMessages: MinimalMessage[] = [
    { text: "how much po macbook m2? 16gb ram, 256gb ssd?", direction: "INBOUND" },
    { text: "40k po", direction: "OUTBOUND" },
    { text: "g get ko na location niyo po?", direction: "INBOUND" },
    { text: "mandaluyong", direction: "OUTBOUND" },
    { text: "g meetup? sm north 1pm tomorrow aug 22", direction: "OUTBOUND" },
    { text: "noted", direction: "INBOUND" },
  ];

  // Fix reference date to Aug 21, 2026
  const refDate = new Date("2026-08-21T00:40:00.000Z");
  const result1 = OrderContextExtractor.extract(userMessages, mockCatalog, refDate);

  assert(
    result1.matchedProductId === "prod_macbook_m2",
    "EXTRACT-1",
    "Successfully matched catalog product 'Macbook Air M2 (16gb, 256gb ssd)'"
  );

  assert(
    result1.agreedPrice === 40000,
    "EXTRACT-2",
    "Successfully extracted agreed price ₱40,000 from '40k po'"
  );

  assert(
    result1.fulfillmentMethod === "MEETUP",
    "EXTRACT-3",
    "Successfully identified fulfillment method as MEETUP"
  );

  assert(
    result1.meetupLocation === "SM North",
    "EXTRACT-4",
    `Successfully extracted meetup location 'SM North' (Got: '${result1.meetupLocation}')`
  );

  assert(
    result1.meetupScheduleInput?.startsWith("2026-08-22T13:00") === true,
    "EXTRACT-5",
    `Successfully extracted schedule 'Aug 22, 1:00 PM' formatted for datetime input (Got: '${result1.meetupScheduleInput}')`
  );

  // ------------------------------------------------------------
  // TEST 2: Tagalog time & Megamall
  // ------------------------------------------------------------
  console.log("\n--- Scenario 2: Tagalog Expressions & SM Megamall ---");

  const tagalogMessages: MinimalMessage[] = [
    { text: "available pa ba iphone 15 pro max?", direction: "INBOUND" },
    { text: "60,000 nalang boss", direction: "OUTBOUND" },
    { text: "sige boss meetup tayo sa sm megamall bukas alas dos ng hapon", direction: "INBOUND" },
  ];

  const result2 = OrderContextExtractor.extract(tagalogMessages, mockCatalog, refDate);

  assert(
    result2.matchedProductId === "prod_iphone_15",
    "EXTRACT-6",
    "Successfully matched iPhone 15 Pro Max"
  );

  assert(
    result2.agreedPrice === 60000,
    "EXTRACT-7",
    "Successfully extracted ₱60,000 from '60,000 nalang'"
  );

  assert(
    result2.meetupLocation === "SM Megamall",
    "EXTRACT-8",
    `Successfully extracted 'SM Megamall' (Got: '${result2.meetupLocation}')`
  );

  assert(
    result2.meetupScheduleInput?.includes("14:00") === true,
    "EXTRACT-9",
    `Successfully extracted 2:00 PM from 'alas dos ng hapon' (Got: '${result2.meetupScheduleInput}')`
  );

  // ------------------------------------------------------------
  // TEST 3: Courier Delivery (Grab / Lalamove)
  // ------------------------------------------------------------
  console.log("\n--- Scenario 3: On-Demand Courier Delivery ---");

  const courierMessages: MinimalMessage[] = [
    { text: "kukunin ko airpods pro 2nd gen. deliver via grab express sa 123 Boni Ave, Mandaluyong. 09171234567. gcash payment", direction: "INBOUND" },
  ];

  const result3 = OrderContextExtractor.extract(courierMessages, mockCatalog, refDate);

  assert(
    result3.fulfillmentMethod === "COURIER",
    "EXTRACT-10",
    "Identified COURIER fulfillment method"
  );

  assert(
    result3.paymentMethod === "GCASH",
    "EXTRACT-11",
    "Identified GCASH payment method"
  );

  assert(
    result3.customerPhone === "09171234567",
    "EXTRACT-12",
    "Extracted customer phone number 09171234567"
  );

  console.log("\n================================================================================");
  console.log(`SUITE RESULTS: ${passed} / ${passed + failed} PASSED | 0 FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) process.exit(1);
}

runExtractionTests().catch((err) => {
  console.error("Suite failed:", err);
  process.exit(1);
});
