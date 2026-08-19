export interface ClassificationResult {
  intent:
    | "PRODUCT_INQUIRY"
    | "PRICE_INQUIRY"
    | "AVAILABILITY_INQUIRY"
    | "PURCHASE_INTENT"
    | "PAYMENT_PROOF"
    | "PAYMENT_INQUIRY"
    | "DISCOUNT_REQUEST"
    | "DELIVERY_INQUIRY"
    | "COMPLAINT"
    | "GENERAL_QUESTION";
  confidence: number;
  leadScore: number;
  leadStatus: "HOT" | "WARM" | "COLD";
  detectedProductKeywords: string[];
  paymentReferenceNumber?: string;
  extractedQuantity?: number;
  summary: string;
}

export class AiClassifier {
  /**
   * Deterministic & context-aware intent classification tailored for Filipino MSME messaging
   * (Supports Taglish, English, slang like HM, avail, pa-reserve, bayad, ref #, etc.)
   */
  public static classifyMessage(text: string, activeCatalogTokens: string[] = []): ClassificationResult {
    const lower = text.toLowerCase().trim();

    // 1. Payment Proof / GCash Reference Detection
    const gcashRefMatch = text.match(/(?:ref(?:erence)?(?:\s*(?:no\.?|#|num))?[:\s]*)([0-9a-zA-Z]{4,25})/i) ||
      text.match(/\b([0-9]{4,16})\b/);
    const paymentKeywords = [
      "paid na",
      "nagbayad",
      "sent payment",
      "sent na",
      "sent gcash",
      "proof of payment",
      "resibo",
      "receipt",
      "transfer",
      "ref ",
      "ref:"
    ];
    const hasPaymentProofIntent = paymentKeywords.some((k) => lower.includes(k));

    if (hasPaymentProofIntent && (gcashRefMatch || lower.includes("paid") || lower.includes("bayad") || lower.includes("sent"))) {
      return {
        intent: "PAYMENT_PROOF",
        confidence: 0.96,
        leadScore: 95,
        leadStatus: "HOT",
        detectedProductKeywords: this.extractProductKeywords(lower),
        paymentReferenceNumber: gcashRefMatch ? gcashRefMatch[1] : undefined,
        summary: "Customer submitted proof of payment or reference number.",
      };
    }

    // 1b. Payment Methods Inquiry (e.g. "Can I pay through GCash?", "May Maya kayo?", "Tumatanggap ba kayo ng COD?")
    const paymentInquiryKeywords = [
      "can i pay",
      "pwede gcash",
      "pwede maya",
      "mode of payment",
      "mop",
      "payment method",
      "paano magbayad",
      "accept gcash",
      "accept maya",
      "accept bank",
      "accept card",
      "tumatanggap ng",
      "tumatanggap kayo",
      "how to pay",
    ];
    if (paymentInquiryKeywords.some((k) => lower.includes(k))) {
      return {
        intent: "PAYMENT_INQUIRY",
        confidence: 0.92,
        leadScore: 82,
        leadStatus: "HOT",
        detectedProductKeywords: this.extractProductKeywords(lower),
        summary: "Customer inquiring about accepted payment options.",
      };
    }

    // 1c. Discount Request / Tawad (e.g. "Can I get a 40% discount?", "May discount ba?", "Puwede tawad?")
    const discountKeywords = [
      "discount",
      "tawad",
      "bawas",
      "less",
      "last price",
      "pwede bawas",
      "may tawad",
      "discount po",
      "% discount",
      "percent discount",
    ];
    if (discountKeywords.some((k) => lower.includes(k))) {
      return {
        intent: "DISCOUNT_REQUEST",
        confidence: 0.91,
        leadScore: 78,
        leadStatus: "WARM",
        detectedProductKeywords: this.extractProductKeywords(lower),
        summary: "Customer asking for a discount or price negotiation.",
      };
    }

    // 2. Urgent Purchase Intent & Reservation
    const purchaseKeywords = [
      "order na ako",
      "order na",
      "pa-reserve",
      "kunin ko na",
      "kukunin ko na",
      "kukunin ko",
      "kunin ko",
      "kukunin",
      "kunin",
      "buy now",
      "bilhin ko",
      "bilhin",
      "mine",
      "check out",
      "i want to buy",
      "get ko na",
      "place order",
    ];
    if (purchaseKeywords.some((k) => lower.includes(k))) {
      return {
        intent: "PURCHASE_INTENT",
        confidence: 0.94,
        leadScore: 90,
        leadStatus: "HOT",
        detectedProductKeywords: this.extractProductKeywords(lower),
        summary: "Customer expresses strong purchase or reservation intent.",
      };
    }

    // 3. Availability Inquiry
    const availKeywords = ["available pa", "avail pa", "may stock", "may available", "on hand", "out of stock", "meron pa", "stock pa"];
    if (availKeywords.some((k) => lower.includes(k))) {
      return {
        intent: "AVAILABILITY_INQUIRY",
        confidence: 0.92,
        leadScore: 80,
        leadStatus: "HOT",
        detectedProductKeywords: this.extractProductKeywords(lower),
        summary: "Customer checking stock availability.",
      };
    }

    // 4. Delivery & Shipping Inquiry (e.g. "How much shipping", "courier", "deliver via LBC/Grab", etc.)
    const deliveryKeywords = [
      "shipping",
      "courier",
      "lalamove",
      "j&t",
      "deliver",
      "delivery",
      "lbc",
      "cod",
      "cash on delivery",
      "location",
      "pick up",
      "pickup",
      "grab",
      "meetup",
      "meet up",
      "sf",
      "shipping fee",
    ];
    if (deliveryKeywords.some((k) => lower.includes(k))) {
      return {
        intent: "DELIVERY_INQUIRY",
        confidence: 0.90,
        leadScore: 75,
        leadStatus: "WARM",
        detectedProductKeywords: this.extractProductKeywords(lower),
        summary: "Customer asking about delivery options, shipping fees, courier, or meetup.",
      };
    }

    // 5. Price Inquiry (Product price queries)
    const priceKeywords = ["hm", "how much", "magkano", "last price", "presyo", "price", "installment", "magkano po"];
    if (priceKeywords.some((k) => lower.includes(k))) {
      return {
        intent: "PRICE_INQUIRY",
        confidence: 0.90,
        leadScore: 75,
        leadStatus: "WARM",
        detectedProductKeywords: this.extractProductKeywords(lower),
        summary: "Customer asking for pricing or product cost.",
      };
    }

    // 6. Complaint or Issue
    const complaintKeywords = ["sira", "damaged", "defective", "tagal", "late", "scam", "mali", "wrong item", "return", "refund"];
    if (complaintKeywords.some((k) => lower.includes(k))) {
      return {
        intent: "COMPLAINT",
        confidence: 0.93,
        leadScore: 40,
        leadStatus: "COLD",
        detectedProductKeywords: this.extractProductKeywords(lower),
        summary: "Customer reporting an issue or concern.",
      };
    }

    // 7. Product Inquiry (Features, Specs, or Model Inquiries)
    const productKeywords = this.extractProductKeywords(lower, activeCatalogTokens);
    if (
      productKeywords.length > 0 ||
      lower.includes("specs") ||
      lower.includes("specification") ||
      lower.includes("warranty") ||
      lower.includes("kaya po ba") ||
      lower.includes("magkano po ang") ||
      lower.includes("magkano ang") ||
      lower.includes("meron kayong") ||
      lower.includes("available po ba ang") ||
      lower.includes("available pa po ba ang")
    ) {
      return {
        intent: "PRODUCT_INQUIRY",
        confidence: 0.85,
        leadScore: 70,
        leadStatus: "WARM",
        detectedProductKeywords: productKeywords,
        summary: "Customer asking for product specifications, model availability, or features.",
      };
    }

    // 8. General Question
    return {
      intent: "GENERAL_QUESTION",
      confidence: 0.70,
      leadScore: 50,
      leadStatus: "COLD",
      detectedProductKeywords: [],
      summary: "General inquiry or greeting.",
    };
  }

  private static extractProductKeywords(lowerText: string, activeCatalogTokens: string[] = []): string[] {
    const matchedTokens: Set<string> = new Set();

    // 1. If active catalog tokens are passed from database, match them directly
    for (const token of activeCatalogTokens) {
      const cleanToken = token.toLowerCase().trim();
      if (cleanToken.length >= 2 && lowerText.includes(cleanToken)) {
        matchedTokens.add(cleanToken);
      }
    }

    // 2. Extract potential alphanumeric model identifiers (e.g. "T480", "M2", "MBA-M2-001", "K2", "RTX4060", "i5")
    const modelPattern = /\b([a-z]{1,4}[-0-9]+[a-z0-9-]*|[a-z0-9]+-[a-z0-9-]+)\b/gi;
    const modelMatches = lowerText.match(modelPattern);
    if (modelMatches) {
      for (const m of modelMatches) {
        if (m.length >= 2 && !["po", "ba", "ko", "na", "pa", "ref", "cod"].includes(m.toLowerCase())) {
          matchedTokens.add(m.toLowerCase());
        }
      }
    }

    // 3. Extract common product noun categories if present
    const commonCategories = ["laptop", "desktop", "phone", "tablet", "charger", "keyboard", "mouse", "monitor", "earphones", "headset", "hub"];
    for (const cat of commonCategories) {
      if (lowerText.includes(cat)) {
        matchedTokens.add(cat);
      }
    }

    return Array.from(matchedTokens);
  }
}
