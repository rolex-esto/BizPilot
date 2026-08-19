import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "../prisma";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface CopilotAnswer {
  question: string;
  answer: string;
  category: "SALES" | "INVENTORY" | "PAYMENTS" | "LEADS" | "CHANNELS" | "GENERAL";
  dataPoints: Array<{ label: string; value: string | number }>;
  recommendedAction?: string;
  timestamp: Date;
}

/**
 * Fetches a comprehensive snapshot of the business data to provide as context to Gemini.
 * This ensures all answers are grounded in real data.
 */
import { SubscriptionEntitlementService } from "../auth/subscription-entitlement";

async function getBusinessContext(businessId: string): Promise<{ context: string; connections: any[] }> {
  const [business, products, orders, customers, payments, calendar, connections, channelEntitlement] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId } }),
    prisma.product.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.order.findMany({
      where: { businessId, environment: "LIVE" },
      include: { customer: true, items: true, payments: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.customer.findMany({ where: { businessId, environment: "LIVE" }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.payment.findMany({ where: { businessId, environment: "LIVE" }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.calendarEvent.findMany({
      where: { businessId },
      include: { customer: true },
      orderBy: { startAt: "asc" },
      take: 30,
    }),
    prisma.platformConnection.findMany({ where: { businessId } }),
    SubscriptionEntitlementService.getChannelEntitlement(businessId).catch(() => null),
  ]);

  const now = new Date();
  const todayStr = now.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // Products summary
  const lowStockProducts = products.filter((p) => p.stockQuantity <= p.safetyStockThreshold);
  const totalStockValue = products.reduce((sum, p) => sum + p.price * p.stockQuantity, 0);

  // Orders summary
  const activeOrders = orders.filter((o) => o.status !== "CANCELLED");
  const grossSales = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const paidPayments = payments.filter((p) => p.status === "PAID");
  const verifiedRevenue = paidPayments.reduce((sum, p) => sum + p.amount, 0);
  const unpaidPayments = payments.filter((p) => p.status === "UNPAID" || p.status === "PENDING_VERIFICATION");
  const totalUnpaid = unpaidPayments.reduce((sum, p) => sum + p.amount, 0);

  // Calendar - today's events
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  const todayEvents = calendar.filter((e) => {
    const d = new Date(e.startAt);
    return d >= todayStart && d < todayEnd;
  });

  const maxChannelsText = channelEntitlement?.maxAllowed === null
    ? "Unlimited"
    : `${channelEntitlement?.maxAllowed ?? 1}`;
  const remainingChannelsText = channelEntitlement?.remainingSlots === null
    ? "Unlimited"
    : `${channelEntitlement?.remainingSlots ?? 0}`;

  const context = `
=== BUSINESS & SUBSCRIPTION PLAN ===
Store Name: ${business?.name || "Unknown"}
Owner: ${business?.ownerName || "Unknown"}
Currency: PHP (Philippine Peso, symbol: ₱)
Today's Date: ${todayStr}
Subscription Status: ${channelEntitlement?.subscriptionStatus || business?.subscriptionStatus || "N/A"}
Plan Tier: ${channelEntitlement?.planName || business?.planTier || "STARTER"}
Connected Social Accounts: ${channelEntitlement?.connectedCount ?? connections.length} of ${maxChannelsText} allowed (${remainingChannelsText} slots remaining)
Allowed Social Platforms: ${channelEntitlement?.allowedPlatforms.join(", ") || "FACEBOOK, INSTAGRAM, WHATSAPP, TIKTOK"}

=== PRODUCTS & INVENTORY (${products.length} active products) ===
${products.map((p) => `- ${p.name} | SKU: ${p.sku} | Category: ${p.category} | Price: ₱${p.price.toLocaleString()} | Stock: ${p.stockQuantity} units | Low Stock Alert: ${p.safetyStockThreshold} | ${p.stockQuantity <= p.safetyStockThreshold ? "⚠️ LOW STOCK" : "OK"}`).join("\n")}

Total Products: ${products.length}
Low Stock Products: ${lowStockProducts.length}
Total Inventory Value (at selling price): ₱${totalStockValue.toLocaleString()}

=== ORDERS (${activeOrders.length} active orders) ===
${activeOrders.slice(0, 20).map((o) => `- ${o.orderNumber} | Customer: ${o.customer.name} | Amount: ₱${o.totalAmount.toLocaleString()} | Status: ${o.status} | Fulfillment: ${o.fulfillmentMethod} | Payment: ${o.payments.map((p) => `${p.paymentMethod}:${p.status}`).join(", ") || "None"}`).join("\n")}

Gross Sales (all orders): ₱${grossSales.toLocaleString()}
Verified Paid Revenue: ₱${verifiedRevenue.toLocaleString()}
Pending/Unpaid Amount: ₱${totalUnpaid.toLocaleString()} across ${unpaidPayments.length} payment(s)

=== CUSTOMERS (${customers.length} total) ===
${customers.slice(0, 15).map((c) => `- ${c.name} | Platform: ${c.primaryPlatform} | Lead Status: ${c.leadStatus} | Orders: ${c.orderCount} | Lifetime Value: ₱${c.lifetimeValue.toLocaleString()}`).join("\n")}

=== TODAY'S SCHEDULE (${todayEvents.length} events) ===
${todayEvents.length > 0 ? todayEvents.map((e) => `- ${new Date(e.startAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })} | ${e.title} | Type: ${e.eventType} | Location: ${e.location || "N/A"} | Customer: ${e.customer?.name || "N/A"}`).join("\n") : "No events scheduled for today."}

=== CONNECTED CHANNELS ===
${connections.length > 0 ? connections.map((c) => `- ${c.platform}: Status=${c.status} (Account: "${c.platformAccountName}", ID: ${c.platformAccountId}) ${c.status === "NEEDS_REAUTH" ? "[REAUTHORIZATION REQUIRED: Token is invalid/expired. Must reconnect account at /channels]" : c.status === "CONNECTED" ? "[ACTIVE & LIVE]" : `[${c.status}]`}`).join("\n") : "No channels connected yet."}

=== UPCOMING CALENDAR EVENTS ===
${calendar.filter((e) => new Date(e.startAt) >= now).slice(0, 10).map((e) => `- ${new Date(e.startAt).toLocaleDateString("en-PH")} ${new Date(e.startAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })} | ${e.title} | Type: ${e.eventType} | ${e.location || ""}`).join("\n") || "No upcoming events."}
`.trim();

  return { context, connections };
}

/**
 * Uses Gemini to answer business questions grounded in real BizPilot data.
 */
export async function askGeminiCopilot(businessId: string, question: string): Promise<CopilotAnswer> {
  const { context: businessContext, connections } = await getBusinessContext(businessId);

  const systemPrompt = `You are the AI Copilot for BizPilot, a business operations platform for Philippine MSMEs (micro, small, and medium enterprises).

CRITICAL RULES:
1. ONLY answer based on the business data provided below. NEVER invent numbers, products, orders, or customers.
2. If the data doesn't contain the information needed, say "I don't have enough data to answer that accurately."
3. Use Philippine Peso (₱) for all currency amounts.
4. Keep answers concise and actionable — you're talking to a busy business owner, not a developer.
5. Use natural, friendly language. No technical jargon.
6. When mentioning metrics, be specific about what period/scope the data covers.
7. If asked to do something you can't (like send messages or modify data), explain what the user can do instead using BizPilot's features.
8. For navigation questions, refer to BizPilot pages: Dashboard (/), Inventory (/inventory), Orders (/orders), Calendar (/calendar), Unified Inbox (/inbox), Channels (/channels), AI Copilot (/copilot), Categories (/categories).
9. FOR CHANNEL STATUS QUESTIONS:
   - If a channel has Status=NEEDS_REAUTH, inform the owner: "Your account is saved, but live authentication currently requires reauthorization. Reconnect your account at /channels to restore live API access."
   - NEVER claim a channel is connected or live when its status is NEEDS_REAUTH.
   - If Status=CONNECTED, state that the channel is active and connected.

RESPONSE FORMAT:
- Give a direct answer first
- Include relevant numbers/details
- End with a brief suggestion or next step when appropriate
- Keep it under 200 words unless the question requires more detail

HERE IS THE CURRENT BUSINESS DATA:
${businessContext}`;

  try {
    const apiKey = process.env.GEMINI_API_KEY || "";
    const qLower = question.toLowerCase();

    // Check if this is a channel inquiry and provide instant grounded fallback if Gemini is offline
    if (!apiKey || apiKey === "your-gemini-api-key-here") {
      if (qLower.includes("channel") || qLower.includes("facebook") || qLower.includes("instagram") || qLower.includes("whatsapp") || qLower.includes("tiktok") || qLower.includes("connect")) {
        const targetPlatform = qLower.includes("facebook") ? "FACEBOOK" : qLower.includes("instagram") ? "INSTAGRAM" : qLower.includes("whatsapp") ? "WHATSAPP" : qLower.includes("tiktok") ? "TIKTOK" : null;
        
        if (targetPlatform) {
          const conn = connections.find((c) => c.platform === targetPlatform);
          if (!conn) {
            return {
              question,
              answer: `Your ${targetPlatform} account is not connected yet. You can connect it at /channels.`,
              category: "CHANNELS",
              dataPoints: [],
              timestamp: new Date(),
            };
          }
          if (conn.status === "NEEDS_REAUTH") {
            return {
              question,
              answer: `Your ${targetPlatform} account ("${conn.platformAccountName}") is saved in your workspace, but live authentication currently requires reauthorization. Please reconnect your account at /channels to restore live message access.`,
              category: "CHANNELS",
              dataPoints: [],
              timestamp: new Date(),
            };
          }
          if (conn.status === "CONNECTED") {
            return {
              question,
              answer: `Your ${targetPlatform} account ("${conn.platformAccountName}") is active and connected.`,
              category: "CHANNELS",
              dataPoints: [],
              timestamp: new Date(),
            };
          }
        }
      }
      return {
        question,
        answer: "The AI Copilot hasn't been set up yet. Please add your Gemini API key in the settings to enable AI-powered answers.\n\nIn the meantime, try asking about: sales, low stock, pending payments, or your schedule.",
        category: "GENERAL",
        dataPoints: [],
        timestamp: new Date(),
      };
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: systemPrompt + "\n\nUser question: " + question }] },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });

    const response = result.response;
    const text = response.text();

    // Determine category from question keywords
    const q = question.toLowerCase();
    let category: CopilotAnswer["category"] = "GENERAL";
    if (q.includes("sell") || q.includes("sales") || q.includes("revenue") || q.includes("income")) category = "SALES";
    else if (q.includes("stock") || q.includes("inventory") || q.includes("product") || q.includes("available")) category = "INVENTORY";
    else if (q.includes("pay") || q.includes("unpaid") || q.includes("gcash") || q.includes("cod") || q.includes("owe")) category = "PAYMENTS";
    else if (q.includes("lead") || q.includes("customer") || q.includes("buyer") || q.includes("hot")) category = "LEADS";
    else if (q.includes("channel") || q.includes("facebook") || q.includes("instagram") || q.includes("whatsapp") || q.includes("connect")) category = "CHANNELS";

    return {
      question,
      answer: text,
      category,
      dataPoints: [],
      recommendedAction: undefined,
      timestamp: new Date(),
    };
  } catch (error: any) {
    console.error("Gemini API error:", error?.message || error);

    const qLower = question.toLowerCase();
    if (qLower.includes("channel") || qLower.includes("facebook") || qLower.includes("instagram") || qLower.includes("whatsapp") || qLower.includes("tiktok") || qLower.includes("connect")) {
      const targetPlatform = qLower.includes("facebook") ? "FACEBOOK" : qLower.includes("instagram") ? "INSTAGRAM" : qLower.includes("whatsapp") ? "WHATSAPP" : qLower.includes("tiktok") ? "TIKTOK" : null;
      if (targetPlatform) {
        const conn = connections.find((c) => c.platform === targetPlatform);
        if (!conn) {
          return {
            question,
            answer: `Your ${targetPlatform} account is not connected yet. You can connect it at /channels.`,
            category: "CHANNELS",
            dataPoints: [],
            timestamp: new Date(),
          };
        }
        if (conn.status === "NEEDS_REAUTH") {
          return {
            question,
            answer: `Your ${targetPlatform} account ("${conn.platformAccountName}") is saved in your workspace, but live authentication currently requires reauthorization. Please reconnect your account at /channels to restore live message access.`,
            category: "CHANNELS",
            dataPoints: [],
            timestamp: new Date(),
          };
        }
        if (conn.status === "CONNECTED") {
          return {
            question,
            answer: `Your ${targetPlatform} account ("${conn.platformAccountName}") is active and connected.`,
            category: "CHANNELS",
            dataPoints: [],
            timestamp: new Date(),
          };
        }
      }
    }

    if (qLower.includes("order") || qLower.includes("sales") || qLower.includes("revenue")) {
      const ordersLive = await prisma.order.findMany({
        where: { businessId, environment: "LIVE" },
      });
      const totalSales = ordersLive.reduce((sum, o) => sum + o.totalAmount, 0);
      return {
        question,
        answer: `You currently have ${ordersLive.length} live production order(s) with total sales of ₱${totalSales.toLocaleString()}. Practice simulator orders are strictly excluded.`,
        category: "SALES",
        dataPoints: [],
        timestamp: new Date(),
      };
    }

    let errorMessage = "I'm having trouble processing your question right now. Please try again in a moment.";
    
    if (error?.message?.includes("404") || error?.message?.includes("not found")) {
      errorMessage = "The AI model is not available. Please check that your Gemini API key is valid (it should start with 'AIzaSy').";
    } else if (error?.message?.includes("401") || error?.message?.includes("403") || error?.message?.includes("API_KEY")) {
      errorMessage = "Your Gemini API key appears to be invalid. Please get a new key from aistudio.google.com/apikey (it should start with 'AIzaSy').";
    }

    return {
      question,
      answer: errorMessage,
      category: "GENERAL",
      dataPoints: [],
      timestamp: new Date(),
    };
  }
}
