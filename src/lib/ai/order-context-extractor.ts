/**
 * BizPilot Order Context & Meetup AI Extractor
 * 
 * Extracts high-accuracy order parameters from Filipino MSME conversations:
 * - Meetup Location (e.g. SM North, Mandaluyong, Megamall, Trinoma, Greenbelt, MRT stations)
 * - Meetup Date & Time (e.g. "1pm tomorrow aug 22", "bukas 2pm", "Aug 22 1:00 PM")
 * - Negotiated Price (e.g. "40k po", "40,000", "38k")
 * - Product Catalog Matching (e.g. "macbook m2", "16gb ram, 256gb ssd")
 * - Fulfillment Method (MEETUP, COURIER, LBC, PICKUP)
 * - Payment Method (GCASH, MAYA, CASH, COD, BANK_TRANSFER)
 * - Delivery Address & Phone Number
 */

export interface ExtractedOrderContext {
  fulfillmentMethod: "MEETUP" | "COURIER" | "LBC" | "PICKUP";
  meetupLocation?: string;
  meetupScheduleIso?: string;
  meetupScheduleInput?: string; // Formatted for <input type="datetime-local"> YYYY-MM-DDTHH:mm
  meetupScheduleHuman?: string; // e.g. "Aug 22, 2026 at 1:00 PM"
  deliveryAddress?: string;
  customerPhone?: string;
  agreedPrice?: number;
  matchedProductId?: string;
  matchedProductName?: string;
  quantity: number;
  paymentMethod: "GCASH" | "MAYA" | "CASH" | "COD" | "BANK_TRANSFER";
  confidence: number;
  extractedFields: string[];
  summary: string;
}

export interface MinimalProduct {
  id: string;
  name: string;
  price: number;
  sku?: string | null;
  stockQuantity?: number;
}

export interface MinimalMessage {
  id?: string;
  text?: string | null;
  content?: string | null;
  direction?: "INBOUND" | "OUTBOUND" | string;
  createdAt?: string | Date;
}

const PHILIPPINE_LOCATIONS = [
  // Major Malls & Commercial Hubs
  "sm north edsa",
  "sm north",
  "sm megamall",
  "sm mega mall",
  "sm mall of asia",
  "sm moa",
  "sm aura",
  "sm fairview",
  "sm southmall",
  "sm manila",
  "sm san lazaro",
  "sm sta mesa",
  "sm marikina",
  "sm taytay",
  "sm masinag",
  "sm cebu",
  "sm lanang",
  "trinoma",
  "vertis north",
  "greenbelt",
  "glorietta",
  "power plant mall",
  "rockwell",
  "robinsons galleria",
  "robinsons manila",
  "robinsons magnolia",
  "ayala malls manila bay",
  "ayala malls the 30th",
  "ayala malls feliz",
  "ayala center cebu",
  "market market",
  "uptown mall",
  "bonifacio high street",
  "high street",
  "bgc",
  "gateway mall",
  "gateway",
  "fisher mall",
  "eastwood mall",
  "eastwood",
  "alabang town center",
  "atc",
  "festival mall",
  "evia lifestyle center",
  "starmall",
  "greenhills",
  "shangri-la plaza",
  "shangrila",
  "venice grand canal",

  // Transit Stations
  "mrt ayala",
  "mrt cubao",
  "mrt north ave",
  "mrt shaw",
  "mrt boni",
  "mrt ortigas",
  "mrt taft",
  "lrt edsa",
  "lrt doroteo jose",
  "lrt monumento",
  "lrt balintawak",
  "lrt roosevelt",
  "lrt gil puyat",
  "lrt vito cruz",

  // Cities & Municipalities
  "mandaluyong",
  "quezon city",
  "qc",
  "makati",
  "taguig",
  "pasig",
  "manila",
  "pasay",
  "caloocan",
  "las piñas",
  "paranaque",
  "muntinlupa",
  "marikina",
  "san juan",
  "valenzuela",
  "malabon",
  "navotas",
  "antipolo",
  "cainta",
  "taytay",
  "bacoor",
  "imus",
  "dasmarinas",
  "dasma",
  "cebu city",
  "davao city",
  "pampanga",
  "angeles city",
  "san fernando",
];

export class OrderContextExtractor {
  /**
   * Analyze conversation messages and catalog to extract structured order intent.
   */
  public static extract(
    messages: MinimalMessage[],
    catalogProducts: MinimalProduct[] = [],
    referenceDate: Date = new Date()
  ): ExtractedOrderContext {
    const combinedTexts: string[] = [];
    const extractedFields: string[] = [];

    // Chronological message texts
    messages.forEach((m) => {
      const t = (m.text || m.content || "").trim();
      if (t) combinedTexts.push(t);
    });

    const fullConversationText = combinedTexts.join(" \n ");
    const lowerFull = fullConversationText.toLowerCase();

    // 1. EXTRACT PRICE / AMOUNT
    let agreedPrice: number | undefined;
    
    // Check for "40k", "40 k", "40,000", "₱40000", "60,000 nalang", etc.
    const priceKMatch = fullConversationText.match(/\b([0-9]{1,3}(?:\.[0-9]{1,2})?)\s*k\b/i);
    const pricePhpMatch = fullConversationText.match(/(?:(?:₱|php|p)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]{3,7}))/i);
    const priceCommaMatch = fullConversationText.match(/\b([1-9][0-9]{0,2}(?:,[0-9]{3})+)\b/);
    const pricePlainNumber = fullConversationText.match(/\b([1-9][0-9]{3,6})\b/);

    if (priceKMatch) {
      agreedPrice = Math.round(parseFloat(priceKMatch[1]) * 1000);
      extractedFields.push(`Agreed Price: ₱${agreedPrice.toLocaleString()}`);
    } else if (pricePhpMatch) {
      const cleanNum = pricePhpMatch[1].replace(/,/g, "");
      agreedPrice = Math.round(parseFloat(cleanNum));
      extractedFields.push(`Agreed Price: ₱${agreedPrice.toLocaleString()}`);
    } else if (priceCommaMatch) {
      const cleanNum = priceCommaMatch[1].replace(/,/g, "");
      agreedPrice = Math.round(parseFloat(cleanNum));
      extractedFields.push(`Agreed Price: ₱${agreedPrice.toLocaleString()}`);
    } else if (pricePlainNumber) {
      agreedPrice = parseInt(pricePlainNumber[1], 10);
      extractedFields.push(`Agreed Price: ₱${agreedPrice.toLocaleString()}`);
    }

    // 2. EXTRACT FULFILLMENT METHOD
    let fulfillmentMethod: "MEETUP" | "COURIER" | "LBC" | "PICKUP" = "MEETUP";
    if (lowerFull.includes("lbc") || lowerFull.includes("j&t") || lowerFull.includes("jnt") || lowerFull.includes("ship")) {
      fulfillmentMethod = "LBC";
      extractedFields.push("Fulfillment: LBC Shipping");
    } else if (lowerFull.includes("grab") || lowerFull.includes("lalamove") || lowerFull.includes("padeliver") || lowerFull.includes("courier")) {
      fulfillmentMethod = "COURIER";
      extractedFields.push("Fulfillment: On-demand Courier (Grab/Lalamove)");
    } else if (lowerFull.includes("pickup") || lowerFull.includes("pick up") || lowerFull.includes("store pickup")) {
      fulfillmentMethod = "PICKUP";
      extractedFields.push("Fulfillment: Store Pickup");
    } else if (lowerFull.includes("meetup") || lowerFull.includes("meet up") || lowerFull.includes("meet") || lowerFull.includes("kita tayo") || lowerFull.includes("location niyo")) {
      fulfillmentMethod = "MEETUP";
      extractedFields.push("Fulfillment: Physical Meetup");
    }

    // 3. EXTRACT MEETUP LOCATION
    let meetupLocation: string | undefined;

    // A. Direct scan for known Philippine malls / landmarks / cities
    for (const loc of PHILIPPINE_LOCATIONS) {
      if (lowerFull.includes(loc)) {
        // Format to Title Case nicely
        meetupLocation = loc
          .split(" ")
          .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
          .join(" ");
        break;
      }
    }

    // B. Pattern scan for "meetup? <loc>", "meet at <loc>", "location: <loc>", "sa <loc>"
    if (!meetupLocation) {
      const meetupPattern = /(?:meetup(?:\s*sa|\s*at|\s*\?)?|location(?:\s*is|\s*niyo|\s*:)?)\s*[:\s]*([a-zA-Z0-9\s,.-]{3,35})(?:\s+(?:1pm|2pm|3pm|4pm|5pm|6pm|7pm|8pm|9pm|10pm|11am|12nn|10am|tomorrow|bukas|today|aug|sept|oct|nov|dec|\d{1,2}:\d{2}|$))/i;
      const mMatch = fullConversationText.match(meetupPattern);
      if (mMatch && mMatch[1] && mMatch[1].trim().length >= 3) {
        meetupLocation = mMatch[1].trim();
      }
    }

    if (meetupLocation) {
      extractedFields.push(`Location: ${meetupLocation}`);
    }

    // 4. EXTRACT MEETUP DATE & TIME (SCHEDULE)
    let meetupScheduleIso: string | undefined;
    let meetupScheduleInput: string | undefined;
    let meetupScheduleHuman: string | undefined;

    const scheduleObj = this.parsePhilippineSchedule(fullConversationText, referenceDate);
    if (scheduleObj) {
      meetupScheduleIso = scheduleObj.iso;
      meetupScheduleInput = scheduleObj.input;
      meetupScheduleHuman = scheduleObj.human;
      extractedFields.push(`Schedule: ${scheduleObj.human}`);
    }

    // 5. EXTRACT PAYMENT METHOD
    let paymentMethod: "GCASH" | "MAYA" | "CASH" | "COD" | "BANK_TRANSFER" = "GCASH";
    if (lowerFull.includes("gcash")) {
      paymentMethod = "GCASH";
      extractedFields.push("Payment: GCash");
    } else if (lowerFull.includes("maya") || lowerFull.includes("paymaya")) {
      paymentMethod = "MAYA";
      extractedFields.push("Payment: Maya");
    } else if (lowerFull.includes("cash on delivery") || lowerFull.includes("cod")) {
      paymentMethod = "COD";
      extractedFields.push("Payment: Cash on Delivery");
    } else if (/\bcash\b/i.test(fullConversationText) || lowerFull.includes("kaliwaan") || lowerFull.includes("abutan")) {
      paymentMethod = "CASH";
      extractedFields.push("Payment: Cash");
    } else if (lowerFull.includes("bpi") || lowerFull.includes("bdo") || lowerFull.includes("unionbank") || lowerFull.includes("bank transfer")) {
      paymentMethod = "BANK_TRANSFER";
      extractedFields.push("Payment: Bank Transfer");
    }

    // 6. EXTRACT PHONE NUMBER
    let customerPhone: string | undefined;
    const phoneMatch = fullConversationText.match(/(?:\+63|0)9\d{9}/);
    if (phoneMatch) {
      customerPhone = phoneMatch[0];
      extractedFields.push(`Phone: ${customerPhone}`);
    }

    // 7. MATCH PRODUCT FROM CATALOG
    let matchedProductId: string | undefined;
    let matchedProductName: string | undefined;

    if (catalogProducts.length > 0) {
      let bestScore = 0;
      let bestProd: MinimalProduct | null = null;

      for (const prod of catalogProducts) {
        const prodNameLower = prod.name.toLowerCase();
        const prodTokens = prodNameLower.split(/[\s,()/-]+/).filter((t) => t.length > 1);

        let matchCount = 0;
        for (const token of prodTokens) {
          if (lowerFull.includes(token)) {
            matchCount += token.length >= 4 ? 2 : 1;
          }
        }

        // Exact substring bonus
        if (lowerFull.includes(prodNameLower)) {
          matchCount += 10;
        }

        if (matchCount > bestScore) {
          bestScore = matchCount;
          bestProd = prod;
        }
      }

      if (bestProd && bestScore >= 2) {
        matchedProductId = bestProd.id;
        matchedProductName = bestProd.name;
        if (!agreedPrice) {
          agreedPrice = bestProd.price;
        }
        extractedFields.push(`Product: ${bestProd.name}`);
      } else {
        matchedProductId = catalogProducts[0].id;
        matchedProductName = catalogProducts[0].name;
      }
    }

    const confidence = Math.min(0.98, 0.4 + extractedFields.length * 0.12);
    const summary = extractedFields.length > 0
      ? `✨ AI Detected: ${extractedFields.join(" • ")}`
      : "Standard 1-Click Order Template";

    return {
      fulfillmentMethod,
      meetupLocation,
      meetupScheduleIso,
      meetupScheduleInput,
      meetupScheduleHuman,
      deliveryAddress: fulfillmentMethod !== "MEETUP" ? meetupLocation : undefined,
      customerPhone,
      agreedPrice,
      matchedProductId,
      matchedProductName,
      quantity: 1,
      paymentMethod,
      confidence,
      extractedFields,
      summary,
    };
  }

  /**
   * Helper to parse date & time expressions common in Filipino e-commerce chats.
   */
  private static parsePhilippineSchedule(
    text: string,
    ref: Date = new Date()
  ): { iso: string; input: string; human: string } | null {
    const lower = text.toLowerCase();

    // 1. Time parsing (e.g. "1pm", "1:00pm", "1:30 pm", "10am", "12nn")
    let hour = 13; // default 1:00 PM
    let minute = 0;
    let hasExplicitTime = false;

    const time12Match = lower.match(/\b([1-9]|1[0-2])(?::([0-5][0-9]))?\s*(am|pm|nn|noon)\b/i);
    const tagalogTimeMatch = lower.match(/alas\s+(una|dos|tres|kwatro|singko|sais|syete|otso|nuebe|dyes|onse|dose)(?:\s+(?:ng\s+)?(umaga|tanghali|hapon|gabi))?/i);

    if (time12Match) {
      let h = parseInt(time12Match[1], 10);
      const m = time12Match[2] ? parseInt(time12Match[2], 10) : 0;
      const meridiem = time12Match[3].toLowerCase();

      if (meridiem === "pm" && h < 12) h += 12;
      if (meridiem === "am" && h === 12) h = 0;
      if (meridiem === "nn" || meridiem === "noon") h = 12;

      hour = h;
      minute = m;
      hasExplicitTime = true;
    } else if (tagalogTimeMatch) {
      const numWord = tagalogTimeMatch[1].toLowerCase();
      const period = tagalogTimeMatch[2] ? tagalogTimeMatch[2].toLowerCase() : "";
      const wordToHour: Record<string, number> = {
        una: 1,
        dos: 2,
        tres: 3,
        kwatro: 4,
        singko: 5,
        sais: 6,
        syete: 7,
        otso: 8,
        nuebe: 9,
        dyes: 10,
        onse: 11,
        dose: 12,
      };

      let h = wordToHour[numWord] || 1;
      if ((period === "hapon" || period === "gabi") && h < 12) h += 12;
      if (period === "tanghali" && h < 12) h += 12;

      hour = h;
      minute = 0;
      hasExplicitTime = true;
    }

    // 2. Date parsing (e.g. "tomorrow", "bukas", "aug 22", "august 22", "today", "ngayon")
    const targetDate = new Date(ref);
    let hasExplicitDate = false;

    // Check specific month + day: "aug 22", "august 22", "sep 5", etc.
    const monthNames: Record<string, number> = {
      jan: 0, january: 0,
      feb: 1, february: 1,
      mar: 2, march: 2,
      apr: 3, april: 3,
      may: 4,
      jun: 5, june: 5,
      jul: 6, july: 6,
      aug: 7, august: 7,
      sep: 8, sept: 8, september: 8,
      oct: 9, october: 9,
      nov: 10, november: 10,
      dec: 11, december: 11,
    };

    const monthDayMatch = lower.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*([1-3]?[0-9])(?:st|nd|rd|th)?\b/i);
    const dayMonthMatch = lower.match(/\b([1-3]?[0-9])(?:st|nd|rd|th)?\s*(?:of\s*)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);

    if (monthDayMatch) {
      const monthIdx = monthNames[monthDayMatch[1].toLowerCase().slice(0, 3)];
      const day = parseInt(monthDayMatch[2], 10);
      if (monthIdx !== undefined && day >= 1 && day <= 31) {
        targetDate.setMonth(monthIdx, day);
        hasExplicitDate = true;
      }
    } else if (dayMonthMatch) {
      const day = parseInt(dayMonthMatch[1], 10);
      const monthIdx = monthNames[dayMonthMatch[2].toLowerCase().slice(0, 3)];
      if (monthIdx !== undefined && day >= 1 && day <= 31) {
        targetDate.setMonth(monthIdx, day);
        hasExplicitDate = true;
      }
    } else if (lower.includes("tomorrow") || lower.includes("bukas")) {
      targetDate.setDate(targetDate.getDate() + 1);
      hasExplicitDate = true;
    } else if (lower.includes("day after tomorrow") || lower.includes("samakalawa")) {
      targetDate.setDate(targetDate.getDate() + 2);
      hasExplicitDate = true;
    } else if (lower.includes("today") || lower.includes("ngayon") || lower.includes("mamaya") || lower.includes("later")) {
      hasExplicitDate = true;
    }

    if (!hasExplicitDate && !hasExplicitTime) {
      return null;
    }

    targetDate.setHours(hour, minute, 0, 0);

    // Format for <input type="datetime-local"> -> YYYY-MM-DDTHH:mm
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
    const dd = String(targetDate.getDate()).padStart(2, "0");
    const hh = String(targetDate.getHours()).padStart(2, "0");
    const min = String(targetDate.getMinutes()).padStart(2, "0");

    const inputVal = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    const isoVal = targetDate.toISOString();

    const humanVal = targetDate.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return {
      iso: isoVal,
      input: inputVal,
      human: humanVal,
    };
  }
}
