import { prisma } from "../prisma";

export interface CopilotAnswer {
  question: string;
  answer: string;
  category: "SALES" | "INVENTORY" | "PAYMENTS" | "LEADS" | "CHANNELS" | "GENERAL";
  dataPoints: Array<{ label: string; value: string | number }>;
  recommendedAction?: string;
  timestamp: Date;
}

export class CopilotQaEngine {
  /**
   * Answers natural language business queries strictly using verified SQLite/Prisma records
   */
  public static async answerQuestion(businessId: string, questionText: string): Promise<CopilotAnswer> {
    const q = questionText.toLowerCase().trim();
    const formatPhp = (amt: number) => `₱${amt.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

    // Security & Credential Protection: Reject requests for raw access tokens, client secrets, passwords, or encryption keys
    if (
      q.includes("access token") ||
      q.includes("client secret") ||
      q.includes("app secret") ||
      q.includes("password") ||
      q.includes("private key") ||
      q.includes("encryption key") ||
      q.includes("bearer token")
    ) {
      return {
        question: questionText,
        answer: "For security and privacy reasons, raw access tokens, client secrets, and credentials cannot be disclosed by the AI Copilot. Sensitive credentials are encrypted in the secure Token Vault.",
        category: "GENERAL",
        dataPoints: [
          { label: "Security Status", value: "ENCRYPTED & PROTECTED" },
        ],
        recommendedAction: "Manage your social platform connections securely via the Channels Settings tab.",
        timestamp: new Date(),
      };
    }

    // 0. Discount & Negotiated Deals Questions
    if (q.includes("discount") || q.includes("tawad") || q.includes("bawas") || (q.includes("negotiat") && (q.includes("much") || q.includes("total") || q.includes("give") || q.includes("granted")))) {
      const orders = await prisma.order.findMany({
        where: { businessId, status: { not: "CANCELLED" } },
        include: { items: true },
      });

      const totalDiscount = orders.reduce((sum, o) => sum + o.discountAmount, 0);
      const ordersWithDiscount = orders.filter((o) => o.discountAmount > 0);
      const negotiatedRevenue = ordersWithDiscount.reduce((sum, o) => sum + o.totalAmount, 0);

      const activeNegotiatingLeads = await prisma.lead.findMany({
        where: { businessId, status: "NEGOTIATING" },
        include: { customer: true, interestedProduct: true },
      });

      let leadSummary = "";
      if (activeNegotiatingLeads.length > 0) {
        const leadLines = activeNegotiatingLeads
          .map(
            (l) =>
              `• ${l.customer.name}: offering ${l.offeredPrice ? formatPhp(l.offeredPrice) : "negotiating"} for ${l.interestedProduct?.name || "item"} (Catalog: ${l.originalPrice ? formatPhp(l.originalPrice) : "N/A"})`
          )
          .join("\n");
        leadSummary = `\n\nCurrently Negotiating Leads (${activeNegotiatingLeads.length}):\n${leadLines}`;
      }

      return {
        question: questionText,
        answer: `You have granted a total of ${formatPhp(totalDiscount)} in negotiated discounts across ${ordersWithDiscount.length} order(s), generating ${formatPhp(negotiatedRevenue)} in actual sales revenue.${leadSummary}`,
        category: "SALES",
        dataPoints: [
          { label: "Total Discounts Granted", value: formatPhp(totalDiscount) },
          { label: "Discounted Orders", value: ordersWithDiscount.length },
          { label: "Negotiated Sales", value: formatPhp(negotiatedRevenue) },
          { label: "Active Negotiations", value: activeNegotiatingLeads.length },
        ],
        recommendedAction: "Review pending negotiations in your Unified Inbox to close deals.",
        timestamp: new Date(),
      };
    }

    // 1. Operations Calendar, Meetups, Couriers, Shipping & Schedule Questions
    if (
      q.includes("schedule") ||
      q.includes("calendar") ||
      q.includes("appointment") ||
      q.includes("meeting") ||
      q.includes("follow up") ||
      q.includes("follow-up") ||
      q.includes("negotiating with") ||
      q.includes("negotiation") ||
      q.includes("meet") ||
      q.includes("kitaan") ||
      q.includes("lbc") ||
      q.includes("ship") ||
      q.includes("padala") ||
      q.includes("courier") ||
      q.includes("collect") ||
      q.includes("cod")
    ) {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const tomorrowStart = new Date(todayStart.getTime() + 86400000);
      const tomorrowEnd = new Date(todayEnd.getTime() + 86400000);
      const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

      const events = await prisma.calendarEvent.findMany({
        where: { businessId },
        include: { customer: true, order: true, lead: true },
        orderBy: { startAt: "asc" },
      });

      const scheduledOrders = await prisma.order.findMany({
        where: {
          businessId,
          status: { not: "CANCELLED" },
        },
        include: { customer: true, items: true, payments: true },
      });

      // 0.1 COD / Uncollected Payments Query
      if (q.includes("cod") || (q.includes("collect") && (q.includes("waiting") || q.includes("pending") || q.includes("how much")))) {
        const unpaidPayments = scheduledOrders.flatMap((o) =>
          o.payments.filter((p) => p.status === "UNPAID" || p.status === "PENDING_VERIFICATION")
            .map((p) => ({ ...p, orderNumber: o.orderNumber, customerName: o.customer.name, fulfillment: o.fulfillmentMethod }))
        );

        const totalUncollected = unpaidPayments.reduce((sum, p) => sum + p.amount, 0);
        const codOrders = unpaidPayments.filter((p) => p.paymentMethod === "COD");

        if (unpaidPayments.length === 0) {
          return {
            question: questionText,
            answer: "All orders are fully paid! You have ₱0 in pending collections.",
            category: "PAYMENTS",
            dataPoints: [{ label: "Pending Collections", value: "₱0" }],
            timestamp: new Date(),
          };
        }

        const codList = codOrders.map((p) => `• ${p.orderNumber} (${p.customerName}) - ${formatPhp(p.amount)} via COD (${p.fulfillment})`).join("\n");

        return {
          question: questionText,
          answer: `You are waiting to collect ${formatPhp(totalUncollected)} across ${unpaidPayments.length} pending payment(s):\n• COD Orders Awaiting Confirmation: ${codOrders.length}\n\n${codList || "No COD orders awaiting confirmation."}`,
          category: "PAYMENTS",
          dataPoints: [
            { label: "Total Awaiting Collection", value: formatPhp(totalUncollected) },
            { label: "Pending COD Orders", value: codOrders.length },
          ],
          recommendedAction: "Confirm collection with courier or customer upon parcel delivery.",
          timestamp: new Date(),
        };
      }

      // 0.2 Courier Delivery Query
      if (q.includes("courier") || (q.includes("deliver") && !q.includes("lbc"))) {
        const courierOrders = scheduledOrders.filter((o) => o.fulfillmentMethod === "COURIER" || o.fulfillmentMethod === "DELIVERY");
        const pendingCourier = courierOrders.filter((o) => o.status !== "DELIVERED");

        if (pendingCourier.length === 0) {
          return {
            question: questionText,
            answer: "You have no pending orders requiring third-party courier (Grab/Lalamove) delivery.",
            category: "SALES",
            dataPoints: [{ label: "Pending Courier Deliveries", value: 0 }],
            timestamp: new Date(),
          };
        }

        const list = pendingCourier.map((o) => `• ${o.orderNumber} - ${o.customer.name} (${o.deliveryAddress || "Address on file"}): ${o.items.map((i) => i.productName).join(", ")} — ${formatPhp(o.totalAmount)}`).join("\n");

        return {
          question: questionText,
          answer: `You have ${pendingCourier.length} order(s) scheduled for on-demand courier dispatch (Grab/Lalamove/Direct):\n\n${list}`,
          category: "SALES",
          dataPoints: [{ label: "Pending Courier Dispatches", value: pendingCourier.length }],
          recommendedAction: "Book Grab Express or Lalamove when items are packed.",
          timestamp: new Date(),
        };
      }

      // 0.3 LBC Shipping Query
      if (q.includes("lbc") || (q.includes("ship") && (q.includes("order") || q.includes("today")))) {
        const lbcOrders = scheduledOrders.filter((o) => o.fulfillmentMethod === "LBC" || o.courier === "LBC");
        const readyToShip = lbcOrders.filter((o) => o.status === "CONFIRMED" || o.status === "PENDING" || o.status === "PACKED");
        const inTransit = lbcOrders.filter((o) => o.status === "SHIPPED");

        const readyList = readyToShip.map((o) => `• ${o.orderNumber} - ${o.customer.name} (${o.deliveryAddress || "Address TBD"}): ${o.items.map((i) => i.productName).join(", ")} — ${formatPhp(o.totalAmount)}`).join("\n");

        return {
          question: questionText,
          answer: `Shipping & Courier Overview (LBC Shipping Status):\n• Ready to Drop-off at LBC: ${readyToShip.length} order(s)\n• In Transit with Tracking: ${inTransit.length} order(s)\n\n${readyList ? `Orders to Drop-off:\n${readyList}` : "No LBC parcels awaiting drop-off."}`,
          category: "SALES",
          dataPoints: [
            { label: "Ready for LBC Drop-off", value: readyToShip.length },
            { label: "In Transit", value: inTransit.length },
          ],
          recommendedAction: "Bring packed parcels to your nearest LBC branch and save waybill tracking numbers.",
          timestamp: new Date(),
        };
      }

      // 0.4 Meetup Queries (Today / Week / All Pending)
      if (q.includes("meet") || q.includes("meetup") || q.includes("kitaan")) {
        const isTodayQuery = q.includes("today");
        const isWeekQuery = q.includes("week");
        const isTomorrowQuery = q.includes("tomorrow");

        const meetups = events.filter((e) => {
          if (e.eventType !== "CUSTOMER_MEETUP") return false;
          const d = new Date(e.startAt);
          if (isTodayQuery) return d >= todayStart && d <= todayEnd;
          if (isTomorrowQuery) return d >= tomorrowStart && d <= tomorrowEnd;
          if (isWeekQuery) return d >= todayStart && d <= weekEnd;
          return e.status === "SCHEDULED";
        });

        const orderMeetups = scheduledOrders.filter((o) => {
          if (!o.meetupSchedule || o.fulfillmentMethod !== "MEETUP") return false;
          const d = new Date(o.meetupSchedule);
          if (isTodayQuery) return d >= todayStart && d <= todayEnd;
          if (isTomorrowQuery) return d >= tomorrowStart && d <= tomorrowEnd;
          if (isWeekQuery) return d >= todayStart && d <= weekEnd;
          return o.meetupStatus === "SCHEDULED" || o.status === "PENDING" || o.status === "CONFIRMED";
        });

        const allMeetupList = [
          ...meetups.map((e) => `• ${e.title} at ${e.location || "Agreed Public Spot"} (${new Date(e.startAt).toLocaleString("en-PH", { dateStyle: "short", timeStyle: "short" })})`),
          ...orderMeetups.map((o) => `• ${o.orderNumber} - Meetup with ${o.customer.name} at ${o.meetupLocation || "Agreed Public Spot"} (${new Date(o.meetupSchedule!).toLocaleDateString()}) — ${formatPhp(o.totalAmount)}`),
        ];

        const scopeLabel = isTodayQuery ? "today" : isTomorrowQuery ? "tomorrow" : isWeekQuery ? "this week" : "total";

        if (allMeetupList.length === 0) {
          return {
            question: questionText,
            answer: `You have no customer meetups scheduled for ${scopeLabel}. Your meetup schedule is clear.`,
            category: "GENERAL",
            dataPoints: [{ label: "Scheduled Meetups", value: 0 }],
            timestamp: new Date(),
          };
        }

        return {
          question: questionText,
          answer: `You have ${allMeetupList.length} customer meetup(s) scheduled (${scopeLabel}):\n\n${allMeetupList.join("\n")}`,
          category: "GENERAL",
          dataPoints: [{ label: "Scheduled Meetups", value: allMeetupList.length }],
          recommendedAction: "Confirm location and schedule with buyers before heading to the meeting spot.",
          timestamp: new Date(),
        };
      }

      // 0.5 Follow-ups & Active Negotiations
      if (q.includes("follow up") || q.includes("follow-up") || q.includes("negotiat")) {
        const followUps = events.filter((e) => e.eventType === "FOLLOW_UP" || e.eventType === "NEGOTIATION_FOLLOW_UP");
        const activeLeads = await prisma.lead.findMany({
          where: { businessId, status: { in: ["NEGOTIATING", "WAITING_FOR_CUSTOMER"] } },
          include: { customer: true, interestedProduct: true },
        });

        const followUpList = [
          ...followUps.map((f) => `• ${f.title} (Scheduled: ${new Date(f.startAt).toLocaleDateString()}) - ${f.status}`),
          ...activeLeads.map((l) => `• ${l.customer.name} (Negotiating ${l.interestedProduct?.name || "Item"}: Offer ${l.offeredPrice ? formatPhp(l.offeredPrice) : "TBD"}, Counter ${l.counterPrice ? formatPhp(l.counterPrice) : "TBD"})`),
        ];

        if (followUpList.length === 0) {
          return {
            question: questionText,
            answer: "No pending customer follow-ups or active negotiations in your pipeline.",
            category: "LEADS",
            dataPoints: [{ label: "Follow-ups Needed", value: 0 }],
            timestamp: new Date(),
          };
        }

        return {
          question: questionText,
          answer: `Here are your pending customer follow-ups and active negotiations (${followUpList.length}):\n\n${followUpList.join("\n")}`,
          category: "LEADS",
          dataPoints: [
            { label: "Calendar Follow-ups", value: followUps.length },
            { label: "Active Negotiating Leads", value: activeLeads.length },
          ],
          recommendedAction: "Send a polite follow-up message via Unified Inbox.",
          timestamp: new Date(),
        };
      }

      // 0.6 General Schedule Today
      const todayAll = events.filter((e) => {
        const d = new Date(e.startAt);
        return d >= todayStart && d <= todayEnd;
      });

      if (todayAll.length === 0) {
        return {
          question: questionText,
          answer: "You have no appointments or operational tasks scheduled for today. Your calendar is clear.",
          category: "GENERAL",
          dataPoints: [{ label: "Today's Events", value: 0 }],
          timestamp: new Date(),
        };
      }

      const agenda = todayAll
        .map((e) => `• [${new Date(e.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}] ${e.title} (${e.eventType}) - ${e.location ? `Spot: ${e.location}` : ""}`)
        .join("\n");

      return {
        question: questionText,
        answer: `Here is your schedule for today (${todayAll.length} activity/activities):\n\n${agenda}`,
        category: "GENERAL",
        dataPoints: [{ label: "Today's Schedule Total", value: todayAll.length }],
        recommendedAction: "Check the Operations Calendar page for full event details.",
        timestamp: new Date(),
      };
    }

    // 5. Sales & Revenue Questions
    if (q.includes("sell") || q.includes("sales") || q.includes("benta") || q.includes("revenue") || q.includes("income") || q.includes("kita")) {
      const orders = await prisma.order.findMany({
        where: { businessId, status: { not: "CANCELLED" } },
        include: { payments: true, items: true },
      });

      const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
      const paidRevenue = orders
        .flatMap((o) => o.payments)
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + p.amount, 0);

      const count = orders.length;

      return {
        question: questionText,
        answer: `Based on your recorded transactions in the database, you have recorded ${count} orders with a total gross sales value of ${formatPhp(totalRevenue)}, of which ${formatPhp(paidRevenue)} is verified paid via GCash/Bank Transfer/Cash.`,
        category: "SALES",
        dataPoints: [
          { label: "Total Orders", value: count },
          { label: "Gross Sales", value: formatPhp(totalRevenue) },
          { label: "Verified Collected", value: formatPhp(paidRevenue) },
        ],
        recommendedAction: "Review pending orders to fulfill and collect remaining balances.",
        timestamp: new Date(),
      };
    }

    // 5.5 Product Catalog / Inventory List Questions
    if (q.includes("what products") || q.includes("list products") || q.includes("catalog") || q.includes("products do i have") || q.includes("what are my products") || (q.includes("products") && q.includes("inventory"))) {
      const products = await prisma.product.findMany({
        where: { businessId, isActive: true },
        orderBy: { name: "asc" },
      });

      if (products.length === 0) {
        return {
          question: questionText,
          answer: "You currently have 0 active products in your catalog.",
          category: "INVENTORY",
          dataPoints: [{ label: "Total Products", value: 0 }],
          timestamp: new Date(),
        };
      }

      const list = products.map((p) => `• ${p.name} (SKU: ${p.sku}) — ${formatPhp(p.price)} [Stock: ${p.stockQuantity}]`).join("\n");
      return {
        question: questionText,
        answer: `You have ${products.length} product(s) registered in your catalog:\n\n${list}`,
        category: "INVENTORY",
        dataPoints: [
          { label: "Total Products", value: products.length },
          { label: "Total Stock", value: products.reduce((s, p) => s + p.stockQuantity, 0) },
        ],
        timestamp: new Date(),
      };
    }

    // 6. Low Stock & Inventory Questions
    if (q.includes("stock") || q.includes("inventory") || q.includes("ubos") || q.includes("low") || q.includes("reorder")) {
      const products = await prisma.product.findMany({
        where: { businessId, isActive: true },
      });

      const lowStockProducts = products.filter((p) => p.stockQuantity <= p.safetyStockThreshold);

      if (lowStockProducts.length === 0) {
        return {
          question: questionText,
          answer: `All ${products.length} active products in your catalog are currently above their minimum safety stock threshold. Inventory levels are healthy.`,
          category: "INVENTORY",
          dataPoints: [{ label: "Total SKUs", value: products.length }, { label: "Low Stock Items", value: 0 }],
          timestamp: new Date(),
        };
      }

      const list = lowStockProducts.map((p) => `• ${p.name} (Stock: ${p.stockQuantity} / Min: ${p.safetyStockThreshold})`).join("\n");

      return {
        question: questionText,
        answer: `You currently have ${lowStockProducts.length} product(s) running at or below safety stock threshold:\n\n${list}\n\nReordering from your suppliers is advised to prevent stockouts.`,
        category: "INVENTORY",
        dataPoints: lowStockProducts.map((p) => ({ label: p.name.split("(")[0].trim(), value: `${p.stockQuantity} units left` })),
        recommendedAction: "Contact suppliers for immediate inventory restock.",
        timestamp: new Date(),
      };
    }

    // 7. Unpaid Orders & Payment Questions
    if (q.includes("owe") || q.includes("unpaid") || q.includes("bayad") || q.includes("pending payment") || q.includes("utang") || q.includes("cod")) {
      const pendingPayments = await prisma.payment.findMany({
        where: {
          businessId,
          status: { in: ["UNPAID", "PENDING_VERIFICATION"] },
        },
        include: { order: true, customer: true },
      });

      const totalUnpaid = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

      if (pendingPayments.length === 0) {
        return {
          question: questionText,
          answer: "There are currently no unpaid or pending payment verifications in your system. All orders are up to date.",
          category: "PAYMENTS",
          dataPoints: [{ label: "Pending Unpaid", value: 0 }],
          timestamp: new Date(),
        };
      }

      const list = pendingPayments
        .map(
          (p) =>
            `• ${p.customer?.name || "Customer"}: ${formatPhp(p.amount)} (${p.paymentMethod} - Status: ${p.status}${
              p.referenceNumber ? `, Ref: ${p.referenceNumber}` : ""
            })`
        )
        .join("\n");

      return {
        question: questionText,
        answer: `There are ${pendingPayments.length} order(s) requiring payment follow-up or verification totaling ${formatPhp(totalUnpaid)}:\n\n${list}`,
        category: "PAYMENTS",
        dataPoints: [
          { label: "Pending Orders", value: pendingPayments.length },
          { label: "Total Outstanding", value: formatPhp(totalUnpaid) },
        ],
        recommendedAction: "Verify GCash reference numbers or confirm cash/COD upon delivery.",
        timestamp: new Date(),
      };
    }

    // 8. Hot Leads & Follow-ups
    if (q.includes("lead") || q.includes("follow up") || q.includes("hot") || q.includes("customer") || q.includes("buyer")) {
      const hotCustomers = await prisma.customer.findMany({
        where: { businessId, leadStatus: { in: ["HOT", "WARM"] } },
        orderBy: { leadScore: "desc" },
        take: 5,
        include: { conversations: true },
      });

      if (hotCustomers.length === 0) {
        return {
          question: questionText,
          answer: "No active hot or warm leads detected in current conversations. New inquiries from connected platforms will appear here automatically.",
          category: "LEADS",
          dataPoints: [{ label: "Hot Leads", value: 0 }],
          timestamp: new Date(),
        };
      }

      const list = hotCustomers
        .map(
          (c) =>
            `• ${c.name} (${c.primaryPlatform} - Score: ${c.leadScore}/100) — Notes: ${c.notes || "High buying intent"}`
        )
        .join("\n");

      return {
        question: questionText,
        answer: `Here are your top ${hotCustomers.length} high-intent customers identified by AI:\n\n${list}`,
        category: "LEADS",
        dataPoints: hotCustomers.map((c) => ({ label: c.name, value: `${c.leadScore} pts (${c.primaryPlatform})` })),
        recommendedAction: "Send personalized response drafts via Unified Inbox.",
        timestamp: new Date(),
      };
    }

    // 8.8 Social Platform Accounts & Subscription Channel Entitlement
    if (
      q.includes("connected account") ||
      q.includes("what facebook account") ||
      q.includes("what accounts") ||
      q.includes("connected pages") ||
      q.includes("how many channel") ||
      q.includes("can i connect") ||
      q.includes("connect another") ||
      q.includes("why can't i connect") ||
      q.includes("disconnect") ||
      q.includes("which page received")
    ) {
      const { SubscriptionEntitlementService } = await import("@/lib/auth/subscription-entitlement");
      const entitlement = await SubscriptionEntitlementService.getChannelEntitlement(businessId);
      const connections = await prisma.platformConnection.findMany({
        where: { businessId },
        orderBy: { createdAt: "asc" },
      });

      const activeConnections = connections.filter((c) => c.status === "CONNECTED");
      const disconnectedConnections = connections.filter((c) => c.status === "DISCONNECTED");
      const suspendedConnections = connections.filter((c) => c.status === "SUSPENDED_BY_PLAN");

      // Disconnect safety prompt
      if (q.includes("disconnect")) {
        return {
          question: questionText,
          answer: "To safely disconnect a social account without losing historical messages or customer records, please navigate to the Channels page and click the Disconnect button next to the target account. For security, I do not directly delete or disconnect live accounts via chat without explicit dashboard confirmation.",
          category: "CHANNELS",
          dataPoints: [{ label: "Connected Accounts", value: activeConnections.length }],
          recommendedAction: "Visit the Channels hub to manage account connections.",
          timestamp: new Date(),
        };
      }

      // Can I connect another account / Why can't I connect
      if (q.includes("can i connect") || q.includes("connect another") || q.includes("why can't i connect")) {
        if (q.includes("tiktok")) {
          return {
            question: questionText,
            answer: "TikTok Messaging requires official enterprise developer review and app approval from ByteDance before live messaging can be activated. In the meantime, you can test TikTok customer workflows in the Developer Simulator.",
            category: "CHANNELS",
            dataPoints: [{ label: "TikTok Status", value: "Pending Enterprise Review" }],
            recommendedAction: "Use Developer Simulator to test TikTok message workflows.",
            timestamp: new Date(),
          };
        }

        const maxLabel = entitlement.maxAllowed === null ? "unlimited" : `${entitlement.maxAllowed}`;
        const canConnect = entitlement.canConnectAnother;

        return {
          question: questionText,
          answer: canConnect
            ? `Yes, you can connect another account! You are currently using ${entitlement.connectedCount} of ${maxLabel} allowed channel connection(s) on your ${entitlement.planName} plan.`
            : `You have reached your limit of ${entitlement.maxAllowed} connected account(s) on your ${entitlement.planName} plan. To connect another account, disconnect an existing channel or upgrade to a higher plan.`,
          category: "CHANNELS",
          dataPoints: [
            { label: "Active Channels", value: `${entitlement.connectedCount} / ${maxLabel}` },
            { label: "Plan", value: entitlement.planName },
          ],
          recommendedAction: canConnect ? "Go to Channels to connect another account." : "Upgrade plan on Pricing page.",
          timestamp: new Date(),
        };
      }

      // List of connected accounts
      if (activeConnections.length === 0) {
        return {
          question: questionText,
          answer: `You currently have 0 social platform accounts connected on your ${entitlement.planName} plan. You can connect up to ${entitlement.maxAllowed ?? "unlimited"} channel(s).`,
          category: "CHANNELS",
          dataPoints: [{ label: "Connected Accounts", value: 0 }],
          recommendedAction: "Connect Facebook, Instagram, or WhatsApp in Channels.",
          timestamp: new Date(),
        };
      }

      const accountList = activeConnections
        .map((c) => `• ${c.platform}: "${c.platformAccountName}" (ID: ${c.platformAccountId}) — Status: Active`)
        .join("\n");

      let suspendedNote = "";
      if (suspendedConnections.length > 0) {
        suspendedNote = `\n\nSuspended by Plan (${suspendedConnections.length}):\n` + suspendedConnections.map((c) => `• ${c.platform}: "${c.platformAccountName}" (Upgrade to reactivate)`).join("\n");
      }

      return {
        question: questionText,
        answer: `You have ${activeConnections.length} active connected account(s) on your ${entitlement.planName} plan:\n\n${accountList}${suspendedNote}`,
        category: "CHANNELS",
        dataPoints: [
          { label: "Connected Accounts", value: activeConnections.length },
          { label: "Plan Limit", value: entitlement.maxAllowed ?? "Unlimited" },
        ],
        recommendedAction: "Manage accounts or add another page from the Channels page.",
        timestamp: new Date(),
      };
    }

    // 9. Channel Distribution
    if (q.includes("channel") || q.includes("platform") || q.includes("facebook") || q.includes("instagram") || q.includes("whatsapp") || q.includes("tiktok") || q.includes("source")) {
      const customers = await prisma.customer.findMany({ where: { businessId } });
      const counts: Record<string, number> = {};
      for (const c of customers) {
        const src = c.source || c.primaryPlatform;
        counts[src] = (counts[src] || 0) + 1;
      }

      return {
        question: questionText,
        answer: `Customer breakdown across sources & channels:\n• Facebook: ${counts["FACEBOOK"] || 0}\n• Instagram: ${counts["INSTAGRAM"] || 0}\n• WhatsApp: ${counts["WHATSAPP"] || 0}\n• TikTok: ${counts["TIKTOK"] || 0}\n• Walk-in / Manual: ${(counts["WALK_IN"] || 0) + (counts["MANUAL"] || 0)}`,
        category: "CHANNELS",
        dataPoints: [
          { label: "Facebook", value: counts["FACEBOOK"] || 0 },
          { label: "Instagram", value: counts["INSTAGRAM"] || 0 },
          { label: "WhatsApp", value: counts["WHATSAPP"] || 0 },
          { label: "TikTok", value: counts["TIKTOK"] || 0 },
          { label: "Walk-in/Manual", value: (counts["WALK_IN"] || 0) + (counts["MANUAL"] || 0) },
        ],
        timestamp: new Date(),
      };
    }

    // General Summary
    return {
      question: questionText,
      answer: `Hello! I am your AI Business Copilot for BizPilot. You can ask me about:
• Today's and monthly sales figures & discounts granted
• Scheduled meetups, LBC shipments in transit, and store pickups
• Low stock alerts and reorder suggestions
• Unpaid customer balances & GCash/Cash verification
• Top hot leads & active customer negotiations
• Customer traffic breakdown across Facebook, Instagram, WhatsApp, TikTok, and Walk-ins.`,
      category: "GENERAL",
      dataPoints: [],
      recommendedAction: "Try asking: 'Which orders are waiting for meetup?' or 'How much discount did I give?'",
      timestamp: new Date(),
    };
  }
}
