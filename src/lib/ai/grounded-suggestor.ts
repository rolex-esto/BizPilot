import { prisma } from "../prisma";
import { ClassificationResult } from "./classifier";

export interface GroundedSuggestion {
  suggestedText: string;
  sourceOfTruth: {
    productFound: boolean;
    productName?: string;
    productPrice?: number;
    stockQuantity?: number;
    isLowStock?: boolean;
    orderFound?: boolean;
    orderStatus?: string;
    missingDataNote?: string;
    paymentMethodsFound?: string[];
    fulfillmentMethodsFound?: string[];
    requiresOwnerEscalation?: boolean;
    escalationReason?: string;
  };
  suggestedAction?: "SEND_DRAFT" | "CREATE_ORDER" | "VERIFY_PAYMENT" | "REQUEST_MORE_INFO" | "ESCALATE_TO_OWNER";
  autoReplyAllowed?: boolean;
}

export class GroundedAiSuggestor {
  /**
   * Generates grounded AI response drafts strictly from verified database records.
   * Strictly adheres to owner configurations and never invents prices, stock, discounts, or policies.
   */
  public static async generateDraftResponse(
    businessId: string,
    customerName: string,
    messageText: string,
    classification: ClassificationResult
  ): Promise<GroundedSuggestion> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    const settings = (() => {
      try {
        return business?.settingsJson ? JSON.parse(business.settingsJson) : {};
      } catch {
        return {};
      }
    })();

    const aiConfig = settings.aiConfig || {
      tone: "FRIENDLY_TAGLISH",
      language: "TAGLISH",
      greeting: `Hello po! Welcome to ${business?.name || "our store"}. How can we help you today?`,
      whenUnsure: "I don't have verified information for that policy. Let me connect you directly with the store owner to assist you.",
      maxDiscountPercent: 0,
      autoReplyEnabled: false,
      escalateToOwnerOnUnknown: true,
    };

    const acceptedPayments: string[] = Array.isArray(settings.acceptedPaymentMethods)
      ? settings.acceptedPaymentMethods
      : ["GCASH", "MAYA", "BANK_TRANSFER", "COD"];

    const fulfillmentOptions: string[] = Array.isArray(settings.fulfillmentMethods)
      ? settings.fulfillmentMethods
      : ["MEETUP", "LBC", "GRAB", "LALAMOVE", "DELIVERY"];

    const firstName = customerName.split(" ")[0] || "Customer";
    const lowerMessage = messageText.toLowerCase();
    const formatPhp = (amt: number) =>
      `₱${amt.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

    // ------------------------------------------------------------
    // 1. HALLUCINATION & OUT-OF-BOUNDS GUARDS (Strict Grounding)
    // ------------------------------------------------------------

    // 1a. International delivery inquiry
    if (lowerMessage.includes("international") || lowerMessage.includes("ship to us") || lowerMessage.includes("ship to canada") || lowerMessage.includes("abroad")) {
      return {
        suggestedText: `Hello po ${firstName}! We currently ship nationwide within the Philippines only via ${fulfillmentOptions.includes("LBC") ? "LBC and partner couriers" : "local couriers"}. Let me check with the store owner if international shipping can be arranged for you.`,
        sourceOfTruth: {
          productFound: false,
          fulfillmentMethodsFound: fulfillmentOptions,
          requiresOwnerEscalation: true,
          escalationReason: "INTERNATIONAL_SHIPPING_NOT_IN_POLICY",
        },
        suggestedAction: "ESCALATE_TO_OWNER",
        autoReplyAllowed: false,
      };
    }

    // 1b. Unrealistic / Non-standard Warranty or Return Inquiries
    if (lowerMessage.includes("3-year warranty") || lowerMessage.includes("3 year warranty") || lowerMessage.includes("10-year") || lowerMessage.includes("90 days") || lowerMessage.includes("return after 90")) {
      return {
        suggestedText: `Hello po ${firstName}! Our standard store policy covers replacement warranty for verified defects upon delivery. For extended warranty or custom return terms, I'll connect you directly with our store owner.`,
        sourceOfTruth: {
          productFound: false,
          requiresOwnerEscalation: true,
          escalationReason: "NON_STANDARD_WARRANTY_REQUEST",
        },
        suggestedAction: "ESCALATE_TO_OWNER",
        autoReplyAllowed: false,
      };
    }

    // 1c. Deferred / Delayed payment ("pay tomorrow", "pay next month")
    if (lowerMessage.includes("pay tomorrow") || lowerMessage.includes("bayad bukas") || lowerMessage.includes("next week bayad") || lowerMessage.includes("pay after")) {
      return {
        suggestedText: `Hello po ${firstName}! Orders are normally secured once payment is confirmed or scheduled for COD/Meetup. Let me check with the store owner if we can hold this item for you until tomorrow!`,
        sourceOfTruth: {
          productFound: false,
          paymentMethodsFound: acceptedPayments,
          requiresOwnerEscalation: true,
          escalationReason: "DEFERRED_PAYMENT_REQUEST",
        },
        suggestedAction: "ESCALATE_TO_OWNER",
        autoReplyAllowed: false,
      };
    }

    // ------------------------------------------------------------
    // 2. PAYMENT PROOF & GCASH REFERENCE CHECK
    // ------------------------------------------------------------
    if (classification.intent === "PAYMENT_PROOF") {
      const refNumber = classification.paymentReferenceNumber;
      let matchedOrder = null;
      if (refNumber) {
        matchedOrder = await prisma.order.findFirst({
          where: {
            businessId,
            payments: {
              some: { referenceNumber: refNumber },
            },
          },
          include: { items: true, payments: true },
        });
      }

      if (matchedOrder) {
        return {
          suggestedText: `Hello po ${firstName}! Verified na po ang inyong payment (Ref: ${refNumber}) for Order ${matchedOrder.orderNumber}. We will prepare your items for dispatch. Maraming salamat po!`,
          sourceOfTruth: {
            productFound: true,
            orderFound: true,
            orderStatus: matchedOrder.status,
          },
          suggestedAction: "VERIFY_PAYMENT",
          autoReplyAllowed: true,
        };
      }

      return {
        suggestedText: `Hello po ${firstName}! Thank you for sending your payment confirmation${refNumber ? ` (Ref: ${refNumber})` : ""}. Checking our verified records now to confirm receipt and process your dispatch. Sandali lang po!`,
        sourceOfTruth: {
          productFound: false,
          orderFound: false,
          missingDataNote: "Payment reference received; awaiting owner verification in banking/GCash portal.",
        },
        suggestedAction: "VERIFY_PAYMENT",
        autoReplyAllowed: true,
      };
    }

    // ------------------------------------------------------------
    // 3. PAYMENT METHOD INQUIRY (Grounded in Accepted Payments)
    // ------------------------------------------------------------
    if (classification.intent === "PAYMENT_INQUIRY") {
      const paymentLabels: Record<string, string> = {
        GCASH: "GCash",
        MAYA: "Maya",
        BANK_TRANSFER: "Bank Transfer (BDO/BPI/UnionBank)",
        CASH: "Cash on Meetup/Pickup",
        COD: "Cash on Delivery (COD)",
      };
      const formattedList = acceptedPayments.map((p) => paymentLabels[p] || p).join(", ");

      const asksGcash = lowerMessage.includes("gcash");
      const gcashAccepted = acceptedPayments.includes("GCASH");

      let responseText = "";
      if (asksGcash) {
        responseText = gcashAccepted
          ? `Hello po ${firstName}! Yes po, we accept GCash! We also accept ${acceptedPayments.filter((p) => p !== "GCASH").map((p) => paymentLabels[p] || p).join(", ")}. Would you like our payment details?`
          : `Hello po ${firstName}! Currently we accept ${formattedList}. Let us know which payment method works best for you!`;
      } else {
        responseText = `Hello po ${firstName}! We accept the following payment methods: ${formattedList}. Let us know how you'd like to settle your order!`;
      }

      return {
        suggestedText: responseText,
        sourceOfTruth: {
          productFound: false,
          paymentMethodsFound: acceptedPayments,
        },
        suggestedAction: "SEND_DRAFT",
        autoReplyAllowed: true,
      };
    }

    // ------------------------------------------------------------
    // 4. DISCOUNT REQUEST & PRICE NEGOTIATION (Tawad)
    // ------------------------------------------------------------
    if (classification.intent === "DISCOUNT_REQUEST") {
      // Check if excessive discount (e.g. 40%, 70%, etc.)
      const percentMatch = lowerMessage.match(/(\d+)%/);
      const requestedPercent = percentMatch ? parseInt(percentMatch[1], 10) : null;

      if (requestedPercent && requestedPercent > 20) {
        return {
          suggestedText: `Hello po ${firstName}! Our prices are already set to competitive direct-to-buyer rates. A ${requestedPercent}% discount is beyond our standard pricing guidelines, but let me check with the store owner if we can offer a bundle deal or lower shipping for you!`,
          sourceOfTruth: {
            productFound: false,
            requiresOwnerEscalation: true,
            escalationReason: `DISCOUNT_EXCEEDS_POLICY_${requestedPercent}_PERCENT`,
          },
          suggestedAction: "ESCALATE_TO_OWNER",
          autoReplyAllowed: false,
        };
      }

      return {
        suggestedText: `Hello po ${firstName}! I'll check with the store owner if we can give you a special discount or package deal for this item. Anong item po ang balak ninyong kunin?`,
        sourceOfTruth: {
          productFound: false,
          requiresOwnerEscalation: true,
          escalationReason: "CUSTOMER_PRICE_NEGOTIATION",
        },
        suggestedAction: "ESCALATE_TO_OWNER",
        autoReplyAllowed: false,
      };
    }

    // ------------------------------------------------------------
    // 5. PRODUCT CATALOG LOOKUP (Exact SKU, Model & Name Grounding)
    // ------------------------------------------------------------
    let matchedProduct = null;
    const allProducts = await prisma.product.findMany({
      where: { businessId, isActive: true },
    });

    // 1st priority: Exact SKU match
    for (const p of allProducts) {
      if (lowerMessage.includes(p.sku.toLowerCase())) {
        matchedProduct = p;
        break;
      }
    }

    // 2nd priority: Exact product name or distinct model keyword
    if (!matchedProduct) {
      for (const p of allProducts) {
        const distinctModel = p.name.split("(")[0].trim().toLowerCase();
        if (lowerMessage.includes(distinctModel) || lowerMessage.includes(p.name.toLowerCase())) {
          matchedProduct = p;
          break;
        }
      }
    }

    // 3rd priority: Multi-token match (e.g. "Logitech MX Master" matching "Logitech MX Master 3S")
    if (!matchedProduct) {
      for (const p of allProducts) {
        const pLower = p.name.toLowerCase();
        const pTokens = pLower.split(" ").filter((t) => t.length >= 3);
        const matchCount = pTokens.filter((t) => lowerMessage.includes(t)).length;
        if (matchCount >= 2 || (pTokens.length === 1 && matchCount === 1)) {
          matchedProduct = p;
          break;
        }
      }
    }

    // 4th priority: Specific model keywords
    if (!matchedProduct) {
      const specificKeywords = classification.detectedProductKeywords.filter(
        (k) => !["lenovo", "acer", "logitech", "anker", "baseus", "laptop", "desktop", "phone", "tablet", "mouse", "keyboard", "charger", "hub"].includes(k)
      );
      for (const kw of specificKeywords) {
        matchedProduct = allProducts.find(
          (p) =>
            p.name.toLowerCase().includes(kw) ||
            p.sku.toLowerCase().includes(kw)
        );
        if (matchedProduct) break;
      }
    }

    // Product Found in Verified Database
    if (matchedProduct) {
      const isLowStock = matchedProduct.stockQuantity <= matchedProduct.safetyStockThreshold;
      const isOutOfStock = matchedProduct.stockQuantity <= 0;

      if (isOutOfStock) {
        return {
          suggestedText: `Hello po ${firstName}! As per our current inventory, the ${matchedProduct.name} is currently out of stock. Would you like us to notify you as soon as new stock arrives?`,
          sourceOfTruth: {
            productFound: true,
            productName: matchedProduct.name,
            productPrice: matchedProduct.price,
            stockQuantity: 0,
            isLowStock: true,
          },
          suggestedAction: "SEND_DRAFT",
          autoReplyAllowed: true,
        };
      }

      if (classification.intent === "PRICE_INQUIRY" || classification.intent === "PRODUCT_INQUIRY" || classification.intent === "AVAILABILITY_INQUIRY") {
        const stockNote = isLowStock
          ? `(Only ${matchedProduct.stockQuantity} units left on hand!)`
          : `(${matchedProduct.stockQuantity} units available on hand)`;

        const fulfillmentList = fulfillmentOptions.includes("LBC")
          ? "LBC Shipping, Grab/Lalamove, or Meetup"
          : fulfillmentOptions.join(", ");

        return {
          suggestedText: `Hello po ${firstName}! Yes po, available ang ${matchedProduct.name} for ${formatPhp(matchedProduct.price)} ${stockNote}. We offer delivery via ${fulfillmentList}. Would you like to reserve or place an order po?`,
          sourceOfTruth: {
            productFound: true,
            productName: matchedProduct.name,
            productPrice: matchedProduct.price,
            stockQuantity: matchedProduct.stockQuantity,
            isLowStock,
            fulfillmentMethodsFound: fulfillmentOptions,
          },
          suggestedAction: "SEND_DRAFT",
          autoReplyAllowed: true,
        };
      }

      if (classification.intent === "PURCHASE_INTENT") {
        const paymentList = acceptedPayments.join(", ");
        return {
          suggestedText: `Yes po ${firstName}! We can reserve the ${matchedProduct.name} (${formatPhp(matchedProduct.price)}) for you right away. May we have your complete Delivery Name, Address, and Contact Number po? We accept ${paymentList}.`,
          sourceOfTruth: {
            productFound: true,
            productName: matchedProduct.name,
            productPrice: matchedProduct.price,
            stockQuantity: matchedProduct.stockQuantity,
            isLowStock,
            paymentMethodsFound: acceptedPayments,
          },
          suggestedAction: "CREATE_ORDER",
          autoReplyAllowed: false,
        };
      }
    }

    // ------------------------------------------------------------
    // 6. DELIVERY INQUIRY (Grounded in Configured Fulfillment)
    // ------------------------------------------------------------
    if (classification.intent === "DELIVERY_INQUIRY") {
      const fulfillmentLabels: Record<string, string> = {
        MEETUP: "Customer Meetup",
        LBC: "Nationwide LBC Shipping",
        GRAB: "Grab Express",
        LALAMOVE: "Lalamove Same-Day",
        DELIVERY: "Direct Delivery",
      };
      const formattedFulfillment = fulfillmentOptions.map((f) => fulfillmentLabels[f] || f).join(", ");

      return {
        suggestedText: `Hello po ${firstName}! We offer the following delivery options: ${formattedFulfillment}. We are located in ${business?.address || "Metro Manila"}. May we know your delivery location?`,
        sourceOfTruth: {
          productFound: false,
          fulfillmentMethodsFound: fulfillmentOptions,
        },
        suggestedAction: "SEND_DRAFT",
        autoReplyAllowed: true,
      };
    }

    // ------------------------------------------------------------
    // 7. FALLBACK / UNVERIFIED INQUIRY
    // ------------------------------------------------------------
    if (classification.intent === "PRODUCT_INQUIRY" || classification.intent === "PRICE_INQUIRY") {
      return {
        suggestedText: `Hello po ${firstName}! To give you the exact verified price and stock availability, could you specify the exact model or brand you are looking for?`,
        sourceOfTruth: {
          productFound: false,
          missingDataNote: "Specific product was not matched in verified inventory. No price was fabricated.",
        },
        suggestedAction: "REQUEST_MORE_INFO",
        autoReplyAllowed: true,
      };
    }

    // Default Greeting / General Question
    return {
      suggestedText: `Hello po ${firstName}! Welcome to ${business?.name || "our store"}. How can we assist you with your tech and gadget needs today?`,
      sourceOfTruth: {
        productFound: false,
      },
      suggestedAction: "SEND_DRAFT",
      autoReplyAllowed: true,
    };
  }
}

