import { SupportedPlatform } from "../connectors/types";

export type CustomerPersonaType =
  | "CURIOUS_CUSTOMER"
  | "PRICE_SHOPPER"
  | "BARGAIN_HUNTER"
  | "PRODUCT_RESEARCHER"
  | "READY_TO_BUY"
  | "DIFFICULT_CUSTOMER"
  | "REPEAT_CUSTOMER"
  | "UNCERTAIN_CUSTOMER"
  | "SUPPORT_REQUEST"
  | "ORDER_FOLLOWUP";

export interface PersonaDefinition {
  type: CustomerPersonaType;
  displayName: string;
  badgeColor: string;
  description: string;
  traits: string[];
  initialTone: "TAGLISH" | "CASUAL_ENGLISH" | "DIRECT" | "POLITE_TAGALOG";
}

export const PERSONA_DEFINITIONS: Record<CustomerPersonaType, PersonaDefinition> = {
  CURIOUS_CUSTOMER: {
    type: "CURIOUS_CUSTOMER",
    displayName: "Curious Customer",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    description: "Inquires about item details, inclusions, item condition, and origin.",
    traits: ["Asks clarifying questions", "Interested in inclusions", "Polite and exploratory"],
    initialTone: "TAGLISH",
  },
  PRICE_SHOPPER: {
    type: "PRICE_SHOPPER",
    displayName: "Price Shopper",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    description: "Focuses strictly on pricing, comparison with other shops, and total landing costs.",
    traits: ["Asks for price first", "Compares costs", "Asks if shipping is included"],
    initialTone: "DIRECT",
  },
  BARGAIN_HUNTER: {
    type: "BARGAIN_HUNTER",
    displayName: "Bargain Hunter (Tawad Master)",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    description: "Always attempts to negotiate lower prices, asks for bundle discounts or free shipping.",
    traits: ["Offers lower price (Tawad)", "Requests cash discounts", "Tries to negotiate freebies"],
    initialTone: "TAGLISH",
  },
  PRODUCT_RESEARCHER: {
    type: "PRODUCT_RESEARCHER",
    displayName: "Product Researcher",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    description: "Asks deep technical specifications, warranty duration, and return policy details.",
    traits: ["Asks about specs & condition", "Inquires about warranty", "Thorough & detail-oriented"],
    initialTone: "CASUAL_ENGLISH",
  },
  READY_TO_BUY: {
    type: "READY_TO_BUY",
    displayName: "Ready-to-Buy (Fast Close)",
    badgeColor: "bg-green-100 text-green-800 border-green-200",
    description: "Decisive buyer looking to order immediately via GCash/Maya and get fast shipping.",
    traits: ["Ready to order immediately", "Asks for GCash QR/details", "Wants same-day or fast courier"],
    initialTone: "DIRECT",
  },
  DIFFICULT_CUSTOMER: {
    type: "DIFFICULT_CUSTOMER",
    displayName: "Difficult / Edge-Case Customer",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
    description: "Tests store limits: demands half-down-half-later payment, 3-year warranty, or overseas shipping.",
    traits: ["Pushes out-of-policy demands", "Tests deferred payment / COD", "Demands custom warranty"],
    initialTone: "TAGLISH",
  },
  REPEAT_CUSTOMER: {
    type: "REPEAT_CUSTOMER",
    displayName: "Repeat / Loyal Customer",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
    description: "Friendly previous buyer who mentions past orders and asks about new stock or loyalty perks.",
    traits: ["Warm, familiar tone", "Refers to previous purchases", "Fast trust"],
    initialTone: "TAGLISH",
  },
  UNCERTAIN_CUSTOMER: {
    type: "UNCERTAIN_CUSTOMER",
    displayName: "Uncertain / Undecided Customer",
    badgeColor: "bg-slate-100 text-slate-800 border-slate-200",
    description: "Unsure which model or product to choose, asks for recommendations based on budget/use.",
    traits: ["Asks for advice", "Mentions general use-case", "Hesitant without guidance"],
    initialTone: "POLITE_TAGALOG",
  },
  SUPPORT_REQUEST: {
    type: "SUPPORT_REQUEST",
    displayName: "Support / Tracking Inquiry",
    badgeColor: "bg-teal-100 text-teal-800 border-teal-200",
    description: "Inquires about order status, LBC tracking numbers, or setup assistance.",
    traits: ["Asks about tracking & updates", "Needs operational support", "Time-sensitive"],
    initialTone: "TAGLISH",
  },
  ORDER_FOLLOWUP: {
    type: "ORDER_FOLLOWUP",
    displayName: "Order Follow-up & Pickup",
    badgeColor: "bg-orange-100 text-orange-800 border-orange-200",
    description: "Coordinates meetup locations, pickup schedules, or payment proof validation.",
    traits: ["Coordinates delivery logistics", "Confirms meetup location/time", "Checks payment clearance"],
    initialTone: "TAGLISH",
  },
};

export interface ConversationTurnMessage {
  direction: "INBOUND" | "OUTBOUND";
  textContent: string;
  sentAt?: Date | string;
}

export interface CatalogProductSummary {
  id: string;
  name: string;
  sku: string;
  price: number;
  stockQuantity: number;
  category?: string;
}

export class CustomerPersonaEngine {
  /**
   * Generates initial customer inbound message grounded in real catalog products
   */
  public static generateInitialMessage(
    product: CatalogProductSummary,
    persona: CustomerPersonaType,
    customerName: string
  ): { text: string; persona: CustomerPersonaType } {
    const pName = product.name;
    const pPrice = product.price.toLocaleString("en-PH");

    switch (persona) {
      case "CURIOUS_CUSTOMER":
        return {
          text: `Hi po! Ask ko lang kung available pa po yung ${pName}? Complete package po ba at ano pong kasamang accessories?`,
          persona,
        };

      case "PRICE_SHOPPER":
        return {
          text: `Hello po, magkano po ang last price for ${pName}? Kasama na po ba delivery fee dito sa Manila?`,
          persona,
        };

      case "BARGAIN_HUNTER":
        return {
          text: `Good day boss! Available pa ba ang ${pName}? Pwede po ba tawad or cash discount kung kunin ko agad today?`,
          persona,
        };

      case "PRODUCT_RESEARCHER":
        return {
          text: `Hi BizPilot, checking on the ${pName} (${product.sku}). How long is the store replacement warranty, and does it come with original receipt?`,
          persona,
        };

      case "READY_TO_BUY":
        return {
          text: `Hi! I want to buy the ${pName} right now. May stock pa po ba? Ready to pay via GCash agad.`,
          persona,
        };

      case "DIFFICULT_CUSTOMER":
        return {
          text: `Hello, interested sa ${pName}. Pwede ba 50% downpayment tapos yung balance upon delivery pagka-test ko? Pwede rin ba 3 years warranty?`,
          persona,
        };

      case "REPEAT_CUSTOMER":
        return {
          text: `Hi boss Juan! Suki nyo po ako, bumili ako sa inyo last month. Available pa ba itong ${pName}? May suki discount ba tayo dyan? :)`,
          persona,
        };

      case "UNCERTAIN_CUSTOMER":
        return {
          text: `Hello po, naghahanap po ako ng magandang item for work and daily use. Okay po ba itong ${pName} or may iba pa po kayong marerecommend?`,
          persona,
        };

      case "SUPPORT_REQUEST":
        return {
          text: `Good day po! Ask ko lang po if na-ship na po yung order ko for ${pName}? Pwede po mahingi tracking number sa LBC?`,
          persona,
        };

      case "ORDER_FOLLOWUP":
        return {
          text: `Hi po! Follow up ko lang po yung meetup natin for ${pName}. Available po ba kayo around Makati / BGC this weekend?`,
          persona,
        };

      default:
        return {
          text: `Hi po! Inquire lang po ako about ${pName}. Magkano po at available pa po ba?`,
          persona: "CURIOUS_CUSTOMER",
        };
    }
  }

  /**
   * Generates the dynamic next turn for a simulated customer based on:
   * 1. Full conversation history (context memory)
   * 2. The Customer Persona
   * 3. The latest reply sent by the Store Owner or AI
   * 4. Real business catalog and settings
   */
  public static generateNextCustomerTurn(
    history: ConversationTurnMessage[],
    persona: CustomerPersonaType,
    catalog: CatalogProductSummary[],
    businessSettings?: {
      acceptedPaymentMethods?: string[];
      fulfillmentMethods?: string[];
    }
  ): { text: string; inferredTopic: string } {
    if (history.length === 0) {
      const fallbackProduct = catalog[0] || { name: "Featured Item", price: 1000, sku: "ITEM-01", stockQuantity: 5 };
      return {
        text: this.generateInitialMessage(fallbackProduct, persona, "Customer").text,
        inferredTopic: "INITIAL_INQUIRY",
      };
    }

    // 1. Detect active product from thread context (Conversation Memory)
    let referencedProduct: CatalogProductSummary | null = null;
    const combinedHistory = history.map((h) => h.textContent).join(" ").toLowerCase();

    for (const prod of catalog) {
      if (
        combinedHistory.includes(prod.name.toLowerCase()) ||
        combinedHistory.includes(prod.sku.toLowerCase()) ||
        prod.name.toLowerCase().split(" ").filter((w) => w.length >= 3).some((w) => combinedHistory.includes(w))
      ) {
        referencedProduct = prod;
        break;
      }
    }

    if (!referencedProduct && catalog.length > 0) {
      referencedProduct = catalog[0];
    }

    const productName = referencedProduct ? referencedProduct.name : "item";
    const productPrice = referencedProduct ? referencedProduct.price : 15000;

    // 2. Determine conversation flow state:
    // Has the owner replied to the latest customer message?
    const lastMessage = history.length > 0 ? history[history.length - 1] : null;
    const lastOutbound = [...history].reverse().find((m) => m.direction === "OUTBOUND");
    const lastOutboundText = lastOutbound ? lastOutbound.textContent.toLowerCase() : "";

    // Count how many consecutive unreplied INBOUND messages the customer has sent at the end
    let consecutiveInboundsAtTail = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].direction === "INBOUND") {
        consecutiveInboundsAtTail++;
      } else {
        break;
      }
    }

    // -------------------------------------------------------------------------
    // BRANCH A: OWNER HAS NOT REPLIED YET (Consecutive customer questions/pings)
    // -------------------------------------------------------------------------
    if (lastMessage && lastMessage.direction === "INBOUND" && consecutiveInboundsAtTail >= 1) {
      const pingIndex = (consecutiveInboundsAtTail - 1) % 3;

      switch (persona) {
        case "BARGAIN_HUNTER": {
          const tawadTarget = Math.round(productPrice * 0.9);
          if (pingIndex === 0) {
            return {
              text: `Up po? Baka pwede ₱${tawadTarget.toLocaleString("en-PH")} kunin ko agad cash today?`,
              inferredTopic: "UNREPLIED_DISCOUNT_PING",
            };
          } else if (pingIndex === 1) {
            return {
              text: `Kahit sagot nyo na lang po shipping fee via Grab/Lalamove if fixed price. Deal na po tayo?`,
              inferredTopic: "UNREPLIED_SHIPPING_PING",
            };
          }
          return {
            text: `Hello boss, online po ba kayo? Ready cash here, let me know po if available.`,
            inferredTopic: "UNREPLIED_AVAILABILITY_PING",
          };
        }

        case "CURIOUS_CUSTOMER": {
          if (pingIndex === 0) {
            return {
              text: `Up po? Kasama po ba original charger, box, and warranty sa ${productName}?`,
              inferredTopic: "UNREPLIED_SPEC_INQUIRY",
            };
          } else if (pingIndex === 1) {
            return {
              text: `Location po pala namin is near Taguig/BGC. Available po ba for meetup or Grab delivery today?`,
              inferredTopic: "UNREPLIED_LOCATION_INQUIRY",
            };
          }
          return {
            text: `Good day po! Follow up ko lang po if available pa yung ${productName}. Salamat!`,
            inferredTopic: "UNREPLIED_FOLLOWUP_PING",
          };
        }

        case "PRICE_SHOPPER": {
          if (pingIndex === 0) {
            return {
              text: `Kasama na po ba delivery fee or may discount po ba kung pick up or GCash payment?`,
              inferredTopic: "UNREPLIED_PRICE_BREAKDOWN",
            };
          } else if (pingIndex === 1) {
            return {
              text: `May bundle promo po ba kayo if kumuha ako ng accessories kasama ng ${productName}?`,
              inferredTopic: "UNREPLIED_BUNDLE_PING",
            };
          }
          return {
            text: `Waiting for your reply po sa total price calculation. Thank you!`,
            inferredTopic: "UNREPLIED_TOTAL_PING",
          };
        }

        case "PRODUCT_RESEARCHER": {
          if (pingIndex === 0) {
            return {
              text: `Gaano po katagal ang store warranty and may official receipt po ba kayong binibigay?`,
              inferredTopic: "UNREPLIED_WARRANTY_INQUIRY",
            };
          } else if (pingIndex === 1) {
            return {
              text: `Wala naman po bang cosmetic scratches, replaced parts, or hidden defects?`,
              inferredTopic: "UNREPLIED_CONDITION_CHECK",
            };
          }
          return {
            text: `Follow up ko lang po regarding the warranty and specs when you have time. Thank you!`,
            inferredTopic: "UNREPLIED_SPECS_PING",
          };
        }

        case "READY_TO_BUY": {
          if (pingIndex === 0) {
            return {
              text: `Ready to pay via GCash po agad today once confirmed. Pa-send na lang po ng payment details.`,
              inferredTopic: "UNREPLIED_PAYMENT_READY",
            };
          } else if (pingIndex === 1) {
            return {
              text: `Pwede po bang same-day delivery via Grab/Lalamove pagka-send ko ng proof of payment?`,
              inferredTopic: "UNREPLIED_SAME_DAY_REQUEST",
            };
          }
          return {
            text: `Good day! Waiting lang po sa reply ninyo para ma-proceed ko na po ang payment.`,
            inferredTopic: "UNREPLIED_CHECKOUT_PING",
          };
        }

        case "DIFFICULT_CUSTOMER": {
          if (pingIndex === 0) {
            return {
              text: `Hello? Online naman kayo pero bakit wala pang reply?`,
              inferredTopic: "UNREPLIED_URGENCY_COMPLAINT",
            };
          } else if (pingIndex === 1) {
            return {
              text: `Pwede po bang Cash on Delivery (COD) tapos test ko muna bago ko bayaran?`,
              inferredTopic: "UNREPLIED_COD_DEMAND",
            };
          }
          return {
            text: `Pa-reply po please kung available o hindi para makahanap ako sa iba.`,
            inferredTopic: "UNREPLIED_ULTIMATUM_PING",
          };
        }

        case "REPEAT_CUSTOMER": {
          if (pingIndex === 0) {
            return {
              text: `Suki here! Pa-reserve naman po muna while waiting for your confirmation, thanks boss!`,
              inferredTopic: "UNREPLIED_SUKI_RESERVE",
            };
          } else if (pingIndex === 1) {
            return {
              text: `Baka may special freebie or loyalty discount voucher for returning buyers?`,
              inferredTopic: "UNREPLIED_LOYALTY_INQUIRY",
            };
          }
          return {
            text: `Let me know po once online kayo boss, thank you!`,
            inferredTopic: "UNREPLIED_SUKI_PING",
          };
        }

        case "UNCERTAIN_CUSTOMER": {
          if (pingIndex === 0) {
            return {
              text: `Alin po kaya mas recommended for heavy multitasking and daily office work?`,
              inferredTopic: "UNREPLIED_ADVICE_REQUEST",
            };
          } else if (pingIndex === 1) {
            return {
              text: `Good for video editing and long hours of use po ba ito?`,
              inferredTopic: "UNREPLIED_USECASE_INQUIRY",
            };
          }
          return {
            text: `Pa-help po mag-decide kapag available po kayo. Salamat po!`,
            inferredTopic: "UNREPLIED_ASSISTANCE_PING",
          };
        }

        case "SUPPORT_REQUEST": {
          if (pingIndex === 0) {
            return {
              text: `Pa-follow up naman po kung may LBC tracking number na para sa parcel ko.`,
              inferredTopic: "UNREPLIED_TRACKING_INQUIRY",
            };
          } else if (pingIndex === 1) {
            return {
              text: `Estimated arrival date po kaya kailan dating sa Metro Manila address?`,
              inferredTopic: "UNREPLIED_ETA_INQUIRY",
            };
          }
          return {
            text: `Any update po sa shipment status? Thank you po!`,
            inferredTopic: "UNREPLIED_LOGISTICS_PING",
          };
        }

        case "ORDER_FOLLOWUP": {
          if (pingIndex === 0) {
            return {
              text: `Available po ba kayo for meetup between 2 PM to 5 PM today sa BGC/Makati?`,
              inferredTopic: "UNREPLIED_MEETUP_SCHEDULING",
            };
          } else if (pingIndex === 1) {
            return {
              text: `Confirming lang po if na-receive nyo na screenshot ng transfer ko?`,
              inferredTopic: "UNREPLIED_TRANSFER_CONFIRM",
            };
          }
          return {
            text: `Pa-update na lang po kapag ready na for dispatch. Thanks!`,
            inferredTopic: "UNREPLIED_DISPATCH_PING",
          };
        }
      }
    }

    // -------------------------------------------------------------------------
    // BRANCH B: OWNER HAS REPLIED (Contextual response to latest owner turn)
    // -------------------------------------------------------------------------
    const isOutOfStockResponse = lastOutboundText.includes("out of stock") || lastOutboundText.includes("ubos na") || lastOutboundText.includes("no stock");
    const isPriceStated = lastOutboundText.includes("₱") || lastOutboundText.includes("price") || lastOutboundText.includes("presyo") || /\d+,\d+|\d{3,6}/.test(lastOutboundText);
    const isDiscountCounteredOrDiscussed =
      lastOutboundText.includes("discount") ||
      lastOutboundText.includes("tawad") ||
      lastOutboundText.includes("less") ||
      lastOutboundText.includes("special offer") ||
      lastOutboundText.includes("bundle promo") ||
      (isPriceStated && (lastOutboundText.includes("pwede") || lastOutboundText.includes("sige") || lastOutboundText.includes("for gcash") || lastOutboundText.includes("if gcash") || lastOutboundText.includes("deal tayo")));
    const isPaymentDetailsGiven =
      lastOutboundText.includes("send to") ||
      lastOutboundText.includes("pay to") ||
      lastOutboundText.includes("qr code") ||
      lastOutboundText.includes("account number") ||
      lastOutboundText.includes("acct #") ||
      (lastOutboundText.includes("gcash") && (lastOutboundText.includes("09") || lastOutboundText.includes("number") || lastOutboundText.includes("qr"))) ||
      (lastOutboundText.includes("bdo") && (lastOutboundText.includes("acct") || lastOutboundText.includes("number"))) ||
      (lastOutboundText.includes("bpi") && (lastOutboundText.includes("acct") || lastOutboundText.includes("number")));
    const isDeliveryOptionsGiven = lastOutboundText.includes("lbc") || lastOutboundText.includes("grab") || lastOutboundText.includes("lalamove") || lastOutboundText.includes("meetup") || lastOutboundText.includes("deliver") || lastOutboundText.includes("shipping");
    const isOwnerEscalated = lastOutboundText.includes("store owner") || lastOutboundText.includes("connect you") || lastOutboundText.includes("assist you directly") || lastOutboundText.includes("check with");

    // CASE 1: Out of stock announced
    if (isOutOfStockResponse) {
      if (persona === "READY_TO_BUY" || persona === "BARGAIN_HUNTER") {
        return {
          text: `Sayang naman po! May ETA po ba kayo kailan dating ng next batch ng ${productName}? Or may iba po ba kayong similar item na available ngayon?`,
          inferredTopic: "RESTOCK_INQUIRY",
        };
      }
      return {
        text: `Noted po. Pwede po pa-notify ako sa chat kapag nagka-stock na ulit ng ${productName}? Thank you!`,
        inferredTopic: "RESTOCK_NOTIFICATION",
      };
    }

    // CASE 2: Discount Negotiation / Agreed Counter-Offer
    if (isDiscountCounteredOrDiscussed) {
      if (persona === "BARGAIN_HUNTER" || persona === "READY_TO_BUY") {
        return {
          text: `Sige po boss, deal na po tayo dyan sa offer nyo! Paki-send po ng GCash number or QR code para makapag-send na ako ng payment now.`,
          inferredTopic: "DEAL_AGREED",
        };
      }
      if (persona === "PRICE_SHOPPER") {
        return {
          text: `Salamat po sa offer! Kasama na po ba dyan ang delivery fee or may separate charge pa po for shipping?`,
          inferredTopic: "DISCOUNT_CLARIFICATION",
        };
      }
    }

    // CASE 3: Payment details provided
    if (isPaymentDetailsGiven) {
      if (persona === "READY_TO_BUY" || persona === "REPEAT_CUSTOMER" || persona === "BARGAIN_HUNTER") {
        return {
          text: `Great! Send ko na po payment sa GCash right now. Once paid, send ko po screenshot ng proof of payment dito together with my delivery address and contact number.`,
          inferredTopic: "PAYMENT_CONFIRMATION",
        };
      }
      if (persona === "DIFFICULT_CUSTOMER") {
        return {
          text: `Pwede po ba Cash on Delivery (COD) na lang para iwas scam? Or pwede po meetup sa mall para ma-check ko muna item bago magbayad?`,
          inferredTopic: "PAYMENT_OBJECTION",
        };
      }
      return {
        text: `Copy po sa payment details. Kasama na po ba dyan ang shipping fee or separate payment po sa rider pagdating?`,
        inferredTopic: "PAYMENT_CLARIFICATION",
      };
    }

    // CASE 3: Delivery & shipping options provided
    if (isDeliveryOptionsGiven) {
      if (persona === "READY_TO_BUY") {
        return {
          text: `LBC Shipping po ang preferred ko para derecho sa address ko sa Cebu City. Paano po computation ng total kasama shipping fee?`,
          inferredTopic: "DELIVERY_SELECTION",
        };
      }
      if (persona === "BARGAIN_HUNTER") {
        return {
          text: `Kung kunin ko via Grab Express today, pwede po bang sagot nyo na po ang ₱150 shipping fee para close deal na tayo?`,
          inferredTopic: "SHIPPING_DISCOUNT_REQUEST",
        };
      }
      return {
        text: `Available po ba ang same-day delivery via Grab/Lalamove dito sa Mandaluyong? Gaano katagal bago ma-dispatch?`,
        inferredTopic: "DELIVERY_INQUIRY",
      };
    }

    // CASE 4: Owner Escalated to Store Owner
    if (isOwnerEscalated) {
      return {
        text: `Sige po boss, wait ko po ang message ni store owner. Willing to pay cash or GCash agad kung magkasundo tayo sa details!`,
        inferredTopic: "AWAITING_OWNER",
      };
    }

    // CASE 5: Discount Negotiation / Agreed
    if (isDiscountCounteredOrDiscussed) {
      if (persona === "BARGAIN_HUNTER" || persona === "READY_TO_BUY") {
        return {
          text: `Sige po boss, deal na po tayo dyan sa offer nyo! Paki-send po ng GCash number or QR code para makapag-send na ako ng payment now.`,
          inferredTopic: "DEAL_AGREED",
        };
      }
    }

    // CASE 6: Price Stated
    if (isPriceStated) {
      switch (persona) {
        case "BARGAIN_HUNTER": {
          const tawadTarget = Math.round(productPrice * 0.9);
          return {
            text: `Boss, baka pwede ₱${tawadTarget.toLocaleString("en-PH")} na lang? Cash payment po ako agad via GCash within the hour.`,
            inferredTopic: "DISCOUNT_NEGOTIATION",
          };
        }

        case "PRICE_SHOPPER":
          return {
            text: `Kasama na po ba ang delivery fee sa presyo na yan, or separate pa po? May discount po ba kung pick-up or GCash?`,
            inferredTopic: "PRICE_BREAKDOWN",
          };

        case "READY_TO_BUY":
          return {
            text: `Sige po, deal ako sa presyo na yan. Paano po payment methods nyo at paano ang delivery process?`,
            inferredTopic: "PURCHASE_INTENT",
          };

        case "PRODUCT_RESEARCHER":
          return {
            text: `Noted po sa price. Ano po exact inclusions (charger, box, cable) and gaano po katagal ang warranty if ever may hardware issue?`,
            inferredTopic: "SPEC_WARRANTY_CHECK",
          };

        case "DIFFICULT_CUSTOMER":
          return {
            text: `Medyo pricey po kumpara sa iba online. Pwede po ba 2 gives or test ko muna 3 days bago full payment?`,
            inferredTopic: "EXCESSIVE_DEMAND",
          };

        case "REPEAT_CUSTOMER":
          return {
            text: `Ganda nyan boss! Kukunin ko po. Pwede po ba pa-reserve hanggang bukas ng umaga para ma-transfer ko funds from my bank?`,
            inferredTopic: "RESERVATION_REQUEST",
          };

        case "UNCERTAIN_CUSTOMER":
          return {
            text: `Sulit po ba yan for heavy multitasking and student use? Gaano po katagal tumatagal ang battery nyan in actual use?`,
            inferredTopic: "ADVICE_INQUIRY",
          };

        default:
          return {
            text: `Sige po, paano po mag-place ng order and gaano po katagal ang delivery papuntang Metro Manila?`,
            inferredTopic: "ORDER_INQUIRY",
          };
      }
    }

    // Default Fallback
    return {
      text: `Salamat po! Pa-send na lang po ng payment details and how to finalize the order.`,
      inferredTopic: "GENERAL_FOLLOWUP",
    };
  }

  /**
   * Generates a realistic set of scenario presets based on active products in the DB catalog
   */
  public static generateScenariosFromCatalog(
    products: CatalogProductSummary[],
    businessSettings?: {
      acceptedPaymentMethods?: string[];
      fulfillmentMethods?: string[];
    }
  ): Array<{
    id: string;
    title: string;
    productName: string;
    productPrice: number;
    stockQuantity: number;
    platform: SupportedPlatform;
    customerName: string;
    persona: CustomerPersonaType;
    initialMessage: string;
    category: string;
    difficulty: "EASY" | "MEDIUM" | "ADVANCED" | "EDGE_CASE";
  }> {
    if (products.length === 0) {
      return [];
    }

    const scenarios = [];

    // 1. Price Inquiry Scenario
    const p1 = products[0];
    scenarios.push({
      id: `scen_price_${p1.id}`,
      title: `${p1.name} — Price & Inquiry Check`,
      productName: p1.name,
      productPrice: p1.price,
      stockQuantity: p1.stockQuantity,
      platform: "FACEBOOK" as SupportedPlatform,
      customerName: "Eduardo Mendoza",
      persona: "PRICE_SHOPPER" as CustomerPersonaType,
      initialMessage: `Hello po! How much po ang ${p1.name} at available pa po ba? Kasama na po ba shipping fee?`,
      category: "PRICE_INQUIRY",
      difficulty: "EASY" as const,
    });

    // 2. Tawad / Bargain Negotiation Scenario
    const p2 = products[1] || products[0];
    scenarios.push({
      id: `scen_tawad_${p2.id}`,
      title: `${p2.name} — Tawad & Price Negotiation`,
      productName: p2.name,
      productPrice: p2.price,
      stockQuantity: p2.stockQuantity,
      platform: "FACEBOOK" as SupportedPlatform,
      customerName: "Grace Villanueva",
      persona: "BARGAIN_HUNTER" as CustomerPersonaType,
      initialMessage: `Hi boss! Interested sa ${p2.name}. May cash discount po ba kung kunin ko agad today?`,
      category: "DISCOUNT_REQUEST",
      difficulty: "MEDIUM" as const,
    });

    // 3. Ready-to-Buy Fast Close Scenario
    const p3 = products[2] || products[0];
    scenarios.push({
      id: `scen_ready_${p3.id}`,
      title: `${p3.name} — Urgent Order via GCash`,
      productName: p3.name,
      productPrice: p3.price,
      stockQuantity: p3.stockQuantity,
      platform: "WHATSAPP" as SupportedPlatform,
      customerName: "Clarissa Tan",
      persona: "READY_TO_BUY" as CustomerPersonaType,
      initialMessage: `Good pm! I want to buy the ${p3.name} right now. May stock pa po ba? Ready to pay via GCash agad for same-day delivery.`,
      category: "PURCHASE_INTENT",
      difficulty: "EASY" as const,
    });

    // 4. Out-of-Stock / Restock Scenario
    const outOfStockProd = products.find((p) => p.stockQuantity <= 0) || products[products.length - 1];
    scenarios.push({
      id: `scen_stock_${outOfStockProd.id}`,
      title: `${outOfStockProd.name} — Stock Availability Check`,
      productName: outOfStockProd.name,
      productPrice: outOfStockProd.price,
      stockQuantity: outOfStockProd.stockQuantity,
      platform: "INSTAGRAM" as SupportedPlatform,
      customerName: "Kenneth Dizon",
      persona: "CURIOUS_CUSTOMER" as CustomerPersonaType,
      initialMessage: `Hi BizPilot! May available stock pa po ba kayo ng ${outOfStockProd.name}?`,
      category: "AVAILABILITY_INQUIRY",
      difficulty: "MEDIUM" as const,
    });

    // 5. Difficult / Edge Case Escalation Scenario
    scenarios.push({
      id: `scen_edge_${p1.id}`,
      title: `${p1.name} — Edge Policy & Deferred Payment Check`,
      productName: p1.name,
      productPrice: p1.price,
      stockQuantity: p1.stockQuantity,
      platform: "TIKTOK" as SupportedPlatform,
      customerName: "Mark Anthony Reyes",
      persona: "DIFFICULT_CUSTOMER" as CustomerPersonaType,
      initialMessage: `Hello, pwede po bang 50% downpayment tapos balance after 2 weeks? May kasama rin bang 3 years warranty at libreng delivery papuntang US?`,
      category: "ESCALATION_TEST",
      difficulty: "EDGE_CASE" as const,
    });

    return scenarios;
  }
}
